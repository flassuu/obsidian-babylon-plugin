import { App, Notice, TFile } from 'obsidian';
import { requestAnilist } from '../utils/fetcher';
import { stripHtml, sanitizeFilename } from '../utils/sanitize';
import { ConflictModal, type ConflictResolution } from '../ui/modals/ConflictModal';
import { TemplateService } from './TemplateService';
import { tr } from '../i18n';
import type { BabylonSettings, MediaDetails, SyncConflict } from '../types';

// graphql: fetch the authenticated user's full anime list for sync
const USER_LIST_QUERY = `
query ($userId: Int, $userName: String, $type: MediaType) {
  MediaListCollection(userId: $userId, userName: $userName, type: $type) {
    lists {
      name
      isCustomList
      status
      entries {
        id
        mediaId
        status
        score
        progress
        progressVolumes
        repeat
        notes
        startedAt { year month day }
        completedAt { year month day }
        updatedAt
        createdAt
        media {
          id
          idMal
          title { romaji english native }
          coverImage { large }
          format
          episodes
          averageScore
          genres
          description
          siteUrl
          status
          studios (isMain: true) { nodes { name } }
        }
      }
    }
  }
}`;

// graphql: push local changes back to anilist
const UPDATE_MUTATION = `
mutation ($id: Int, $mediaId: Int, $status: MediaListStatus, $score: Float, $progress: Int, $notes: String) {
  SaveMediaListEntry(id: $id, mediaId: $mediaId, status: $status, score: $score, progress: $progress, notes: $notes) {
    id
    status
    score
    progress
    notes
  }
}`;

interface AnilistEntry {
	id: number;
	mediaId: number;
	status: string | null;
	score: number | null;
	progress: number | null;
	progressVolumes: number | null;
	repeat: number | null;
	notes: string | null;
	startedAt: { year: number | null; month: number | null; day: number | null };
	completedAt: { year: number | null; month: number | null; day: number | null };
	updatedAt: number | null;
	createdAt: number | null;
	media: {
		id: number;
		title: { romaji: string | null; english: string | null; native: string | null };
		coverImage: { large: string | null };
		format: string | null;
		episodes: number | null;
		averageScore: number | null;
		genres: string[] | null;
		description: string | null;
		siteUrl: string | null;
		studios: { nodes: Array<{ name: string }> | null } | null;
	};
}

// bidirectional sync between local obsidian notes and anilist
export class AnilistSyncService {
	private app: App;
	private token: string;
	private settings: BabylonSettings;

	constructor(app: App, token: string, settings: BabylonSettings) {
		this.app = app;
		this.token = token;
		this.settings = settings;
	}

	// run a full sync: fetch remote list, match against local files, create/update/conflict
	async sync(): Promise<void> {
		new Notice(tr('sync-in-progress'));

		try {
			const entries = await this.fetchUserList();
			if (entries.length === 0) {
				new Notice(tr('sync-nothing'));
				return;
			}

			const animeFolder = this.settings.media.anime?.folder || 'Content/Anime';
			const existingFiles = this.getExistingNotes(animeFolder);

			for (const entry of entries) {
				const sourceId = String(entry.mediaId);
				const existingFile = existingFiles.get(sourceId);

				if (existingFile) {
					await this.handleExistingEntry(entry, existingFile, sourceId);
				} else {
					await this.createNoteFromEntry(entry, sourceId);
				}
			}

			new Notice(tr('sync-complete'));
		} catch (err) {
			console.error('Babylon: Sync failed', err);
			new Notice(tr('sync-error'));
		}
	}

	private async fetchUserList(): Promise<AnilistEntry[]> {
		const data = await requestAnilist(USER_LIST_QUERY, { type: 'ANIME' }, this.token) as Record<string, unknown>;

		const collection = data?.['MediaListCollection'] as Record<string, unknown> ?? {};
		const lists = (collection['lists'] as Array<Record<string, unknown>>) ?? [];

		const entries: AnilistEntry[] = [];
		for (const list of lists) {
			const listEntries = (list['entries'] as AnilistEntry[]) ?? [];
			entries.push(...listEntries);
		}

		return entries;
	}

	// scan the vault for existing notes by matching the ` - sourceId.md` pattern
	private getExistingNotes(folder: string): Map<string, TFile> {
		const files = this.app.vault.getFiles();
		const result = new Map<string, TFile>();

		for (const file of files) {
			if (!file.path.startsWith(folder)) continue;
			const match = file.name.match(/ - (\d+)\.md$/);
			if (match && match[1]) {
				result.set(match[1], file);
			}
		}

		return result;
	}

	// handle a note that already exists: either update from remote or check for conflicts
	private async handleExistingEntry(entry: AnilistEntry, file: TFile, sourceId: string): Promise<void> {
		// one-way sync: just overwrite local with remote
		if (!this.settings.anilistSync.twoWaySync) {
			await this.updateNoteFromRemote(entry, file);
			return;
		}

		// two-way: read local frontmatter and compare against remote
		const content = await this.app.vault.read(file);
		const frontmatter = this.parseFrontmatter(content);
		const localStatus: string | null = typeof frontmatter['status'] === 'string' ? frontmatter['status'] : null;
		const localScore: number | null = typeof frontmatter['rating'] === 'number' ? frontmatter['rating'] : null;
		const localProgress: number | null = typeof frontmatter['progress'] === 'number' ? frontmatter['progress'] : null;
		const localNote: string | null = typeof frontmatter['notes'] === 'string' ? frontmatter['notes'] : null;

		const remoteStatus = entry.status?.toLowerCase() ?? null;
		const remoteScore = entry.score ?? null;
		const remoteProgress = entry.progress ?? null;
		const remoteNotes = entry.notes ?? null;

		const hasConflict =
			(localStatus && remoteStatus && localStatus !== this.mapAnilistStatus(remoteStatus)) ||
			(localScore !== null && remoteScore !== null && Math.abs(localScore - remoteScore) > 0.1) ||
			(localProgress !== null && remoteProgress !== null && localProgress !== remoteProgress);

		if (!hasConflict) return;

		// present the user with a conflict resolution modal
		const conflict: SyncConflict = {
			sourceId,
			title: this.pickTitle(entry.media.title),
			localStatus: this.mapBabylonStatus(localStatus),
			remoteStatus,
			localScore,
			remoteScore,
			localProgress,
			remoteProgress,
			localNote,
			remoteNote: remoteNotes,
		};

		return new Promise((resolve) => {
			const modal = new ConflictModal(this.app, conflict, (resolution: ConflictResolution) => {
				void (async () => {
					try {
						await this.applyResolution(resolution, entry, file, conflict);
					} catch (err) {
						console.error('Babylon: Conflict resolution failed', err);
					}
					resolve();
				})();
			});
			modal.open();
		});
	}

	private async applyResolution(
		resolution: ConflictResolution,
		entry: AnilistEntry,
		file: TFile,
		conflict: SyncConflict,
	): Promise<void> {
		switch (resolution) {
			case 'use-remote':
				await this.updateNoteFromRemote(entry, file);
				break;
			case 'push-to-anilist':
				await this.pushToAnilist(entry, conflict);
				break;
			case 'keep-local':
			case 'skip':
				break;
		}
	}

	// overwrite the local note's frontmatter with remote data
	private async updateNoteFromRemote(entry: AnilistEntry, file: TFile): Promise<void> {
		const content = await this.app.vault.read(file);
		const frontmatter = this.parseFrontmatter(content);

		frontmatter['status'] = this.mapAnilistStatus(entry.status ?? '');
		frontmatter['rating'] = entry.score ?? frontmatter['rating'];
		frontmatter['progress'] = entry.progress ?? frontmatter['progress'];
		frontmatter['notes'] = entry.notes ?? frontmatter['notes'];
		frontmatter['lastSyncAt'] = new Date().toISOString();

		const newContent = this.stringifyFrontmatter(frontmatter, content);
		await this.app.vault.modify(file, newContent);
	}

	// push local changes back to the anilist server
	private async pushToAnilist(entry: AnilistEntry, conflict: SyncConflict): Promise<void> {
		const anilistStatus = conflict.localStatus
			? this.mapBabylonStatus(conflict.localStatus)
			: null;

		await requestAnilist(UPDATE_MUTATION, {
			id: entry.id || null,
			mediaId: entry.mediaId,
			status: anilistStatus,
			score: conflict.localScore,
			progress: conflict.localProgress,
			notes: conflict.localNote,
		}, this.token);
	}

	// create a new note from a remote entry that doesn't exist locally yet
	private async createNoteFromEntry(entry: AnilistEntry, sourceId: string): Promise<void> {
		const folder = this.settings.media.anime?.folder || 'Content/Anime';
		const title = this.pickTitle(entry.media.title);
		const filename = `${sanitizeFilename(title)} - ${sourceId}.md`;
		const filePath = `${folder}/${filename}`;

		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing) return;

		const media = entry.media;
		const studios = media.studios?.nodes?.map((n) => n.name).filter(Boolean) ?? [];

		const details: MediaDetails = {
			title,
			originalTitle: media.title.romaji ?? media.title.native ?? null,
			year: null,
			description: media.description ? stripHtml(media.description) : null,
			cover: media.coverImage?.large ?? null,
			genres: media.genres ?? [],
			studios: studios,
			averageScore: media.averageScore ?? null,
			siteUrl: media.siteUrl ?? null,
			format: media.format ?? null,
			episodes: media.episodes ?? null,
			sourceId,
			provider: 'anilist',
			status: this.mapAnilistStatus(entry.status ?? ''),
			score: entry.score,
			progress: entry.progress,
			notes: entry.notes,
			lastSyncAt: new Date().toISOString(),
		};

		const templateService = new TemplateService(this.app);
		const rendered = await templateService.render(
			this.settings.media.anime?.templatePath ?? '',
			details,
		);

		await this.ensureFolder(folder);
		await this.app.vault.create(filePath, rendered);
	}

	private async ensureFolder(folder: string): Promise<void> {
		if (!folder) return;
		const parts = folder.split('/');
		let current = '';
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const exists = this.app.vault.getAbstractFileByPath(current);
			if (!exists) {
				try {
					await this.app.vault.createFolder(current);
				} catch (e) {
					console.warn('Babylon: Failed to create folder', current, e);
				}
			}
		}
	}

	private parseFrontmatter(content: string): Record<string, unknown> {
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match || !match[1]) return {};

		const result: Record<string, unknown> = {};
		const lines = match[1].split('\n');
		const reKey = /^(\w+):\s*(.*)$/;
		for (const line of lines) {
			const kv = reKey.exec(line);
			if (!kv || !kv[1]) continue;
			const key = kv[1];
			const raw = kv[2]?.trim() ?? '';
			if (raw === 'null' || raw === '') {
				result[key] = null;
			} else if (raw === 'true') {
				result[key] = true;
			} else if (raw === 'false') {
				result[key] = false;
			} else if (!isNaN(Number(raw))) {
				result[key] = Number(raw);
			} else {
				result[key] = raw;
			}
		}
		return result;
	}

	// serialize frontmatter back to yaml, preserving the original body
	private stringifyFrontmatter(frontmatter: Record<string, unknown>, content: string): string {
		let yaml = '---\n';
		for (const [key, val] of Object.entries(frontmatter)) {
			if (val === null || val === undefined) {
				yaml += `${key}: \n`;
			} else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
				yaml += `${key}: ${val}\n`;
			} else {
				yaml += `${key}: ${JSON.stringify(val)}\n`;
			}
		}
		yaml += '---\n';

		const match = content.match(/^---\n[\s\S]*?\n---\n/);
		const body = match ? content.slice(match[0].length) : content;
		return yaml + body.trim();
	}

	private pickTitle(title: { romaji?: string | null; english?: string | null; native?: string | null }): string {
		return title.english ?? title.romaji ?? title.native ?? 'Unknown';
	}

	// convert anilist status string to babylon internal status
	private mapAnilistStatus(status: string): string {
		const map: Record<string, string> = {
			'current': 'in_progress',
			'planning': 'plan_to',
			'completed': 'completed',
			'dropped': 'dropped',
			'paused': 'on_hold',
			'repeating': 'in_progress',
		};
		return map[status?.toLowerCase()] ?? status?.toLowerCase() ?? 'not_started';
	}

	// convert babylon internal status to anilist's MediaListStatus enum
	private mapBabylonStatus(status: string | null): string | null {
		const map: Record<string, string> = {
			'in_progress': 'CURRENT',
			'plan_to': 'PLANNING',
			'completed': 'COMPLETED',
			'dropped': 'DROPPED',
			'on_hold': 'PAUSED',
			'not_started': 'PLANNING',
		};
		return status ? (map[status.toLowerCase()] ?? status) : null;
	}
}
