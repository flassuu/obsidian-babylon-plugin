import { App, Modal } from 'obsidian';
import { fetchAnilistUserId, requestAnilist } from '../../utils/fetcher';
import { stripHtml } from '../../utils/sanitize';
import { tr } from '../../i18n';
import type { MediaDetails } from '../../types';

const LIST_QUERY = `
query ($userId: Int!, $type: MediaType) {
  MediaListCollection(userId: $userId, type: $type) {
    lists {
      entries {
        id
        mediaId
        status
        score
        progress
        notes
        media {
          id
          title { romaji english native }
          coverImage { large }
          format
          episodes
          averageScore
          genres
          description(asHtml: false)
          siteUrl
          studios(isMain: true) { nodes { name } }
        }
      }
    }
  }
}`;

interface ListEntry {
	id: number;
	mediaId: number;
	status: string | null;
	score: number | null;
	progress: number | null;
	notes: string | null;
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

export class AddFromListModal extends Modal {
	private entries: ListEntry[] = [];
	private filtered: ListEntry[] = [];
	private searchInput!: HTMLInputElement;
	private listContainer!: HTMLElement;

	constructor(
		app: App,
		private token: string,
		private onSelect: (details: MediaDetails) => void,
	) {
		super(app);
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: tr('add-from-list') });

		const loadingEl = contentEl.createEl('p', { text: 'Loading...' });

		try {
			const userId = await fetchAnilistUserId(this.token);
			const data = await requestAnilist(LIST_QUERY, { userId, type: 'ANIME' }, this.token) as Record<string, unknown>;

			const collection = data?.['MediaListCollection'] as Record<string, unknown> ?? {};
			const lists = (collection['lists'] as Array<Record<string, unknown>>) ?? [];

			this.entries = [];
			for (const list of lists) {
				const listEntries = (list['entries'] as ListEntry[]) ?? [];
				this.entries.push(...listEntries);
			}

			loadingEl.remove();
			this.renderList(contentEl);
		} catch (err) {
			loadingEl.textContent = err instanceof Error ? err.message : 'Failed to load list';
			console.error('Babylon: Failed to load AniList', err);
		}
	}

	private renderList(container: HTMLElement): void {
		this.searchInput = container.createEl('input', {
			type: 'text',
			placeholder: tr('search-placeholder'),
			cls: 'babylon-search-input',
		});
		this.searchInput.addEventListener('input', () => this.filterEntries());

		this.listContainer = container.createDiv({ cls: 'babylon-list-container' });

		this.filterEntries();
	}

	private filterEntries(): void {
		const q = this.searchInput.value.toLowerCase().trim();
		this.filtered = q
			? this.entries.filter((e) => {
				const title = this.pickTitle(e.media.title).toLowerCase();
				return title.includes(q);
			})
			: this.entries;

		this.renderEntries();
	}

	private renderEntries(): void {
		this.listContainer.empty();

		for (const entry of this.filtered) {
			const title = this.pickTitle(entry.media.title);
			const status = entry.status?.toLowerCase() ?? '';
			const media = entry.media;

			const card = this.listContainer.createDiv({ cls: 'babylon-list-entry' });

			if (media.coverImage?.large) {
				card.createEl('img', {
					attr: {
						src: media.coverImage.large,
						width: '40',
						height: '56',
						style: 'object-fit: cover; border-radius: 4px;',
					},
				});
			}

			const info = card.createDiv();
			info.createEl('strong', { text: title });
			const meta: string[] = [];
			if (status) meta.push(status);
			if (media.format) meta.push(media.format);
			if (entry.progress !== null) meta.push(`${entry.progress}/${media.episodes ?? '?'}`);
			if (entry.score !== null) meta.push(`\u2605 ${entry.score}`);
			if (meta.length) {
				info.createDiv({
					text: meta.join(' \u00b7 '),
					cls: 'babylon-search-meta',
				});
			}

			card.addEventListener('click', () => {
				this.selectEntry(entry);
			});
		}

		if (this.filtered.length === 0) {
			this.listContainer.createEl('p', { text: tr('search-no-results') });
		}
	}

	private selectEntry(entry: ListEntry): void {
		const media = entry.media;
		const studios = media.studios?.nodes?.map((n) => n.name).filter(Boolean) ?? [];

		const details: MediaDetails = {
			title: this.pickTitle(media.title),
			originalTitle: media.title.romaji ?? media.title.native ?? null,
			year: null,
			description: media.description ? stripHtml(media.description) : null,
			cover: media.coverImage?.large ?? null,
			genres: media.genres ?? [],
			creators: studios,
			rating: media.averageScore ?? null,
			url: media.siteUrl ?? null,
			format: media.format ?? null,
			progressTotal: media.episodes ?? null,
			sourceId: String(media.id),
			provider: 'anilist',
			status: entry.status?.toLowerCase() ?? 'not_started',
			score: entry.score,
			progress: entry.progress,
			notes: entry.notes,
		};

		this.close();
		this.onSelect(details);
	}

	private pickTitle(title: { romaji?: string | null; english?: string | null; native?: string | null }): string {
		return title.english ?? title.romaji ?? title.native ?? 'Unknown';
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
