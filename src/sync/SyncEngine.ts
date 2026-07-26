import { App, Notice, TFile } from 'obsidian';
import type { MediaType } from '../types';
import { tr } from '../i18n';
import type { SyncFieldMap, SyncFieldChange, NoteSyncChange, SyncResult } from './types';
import { loadFieldMap, getDefaultFieldMap, makeFieldMapPath } from './SyncFieldMap';
import { NoteIgnoreStore } from './NoteIgnoreStore';
import type BabylonPlugin from '../main';

// extract sourceId from a filename matching "Title - 12345.md"
const SOURCE_ID_RE = / - (\d+)\.md$/;

export function extractSourceId(filename: string): string | null {
	const m = filename.match(SOURCE_ID_RE);
	return m?.[1] ?? null;
}

// parse simple frontmatter (no multi-line arrays/objects)
export function parseFrontmatter(content: string): Record<string, unknown> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match?.[1]) return {};
	const result: Record<string, unknown> = {};
	for (const line of match[1].split('\n')) {
		const kv = /^(\w+):\s*(.*)$/.exec(line);
		if (!kv?.[1]) continue;
		const key = kv[1];
		const raw = kv[2]?.trim() ?? '';
		if (raw === '' || raw === 'null') {
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

// write updated frontmatter back, preserving the note body
export function updateFrontmatter(
	content: string,
	updates: Record<string, string | number | boolean | null>,
): string {
	let fm = '---\n';
	for (const [key, val] of Object.entries(updates)) {
		if (val === null || val === undefined) {
			fm += `${key}: \n`;
		} else if (typeof val === 'string') {
			fm += `${key}: ${val}\n`;
		} else {
			fm += `${key}: ${val}\n`;
		}
	}
	fm += '---\n';
	const match = content.match(/^---\n[\s\S]*?\n---\n/);
	const body = match ? content.slice(match[0].length) : content;
	return fm + body.trim();
}

// try to find a value in frontmatter by trying property names in order
function resolveFrontmatterValue(
	fm: Record<string, unknown>,
	property: string,
	key: string,
): string | number | null {
	// 1. exact match by property name
	if (fm[property] !== undefined) return fm[property] as string | number;

	// 2. exact match by key
	if (key !== property && fm[key] !== undefined) return fm[key] as string | number;

	// 3. case-insensitive scan
	const lowerProperty = property.toLowerCase();
	const lowerKey = key.toLowerCase();
	for (const [k, v] of Object.entries(fm)) {
		const lower = k.toLowerCase();
		if (lower === lowerProperty || lower === lowerKey) {
			return v as string | number;
		}
	}

	return null;
}

// types for generic remote data
export type RemoteEntryValues = Record<string, string | number | null>;
export type RemoteDataMap = Map<string, RemoteEntryValues>;

export class SyncEngine {
	private app: App;
	private plugin: BabylonPlugin;
	private ignoreStore: NoteIgnoreStore;

	constructor(plugin: BabylonPlugin) {
		this.app = plugin.app;
		this.plugin = plugin;
		this.ignoreStore = new NoteIgnoreStore(plugin);
	}

	// run a full sync for a media type
	async syncAll(
		mediaType: MediaType,
		remoteData: RemoteDataMap,
	): Promise<SyncResult> {
		const result: SyncResult = { mediaType, changes: [] };

		// 1. load field map
		const fieldMap = await this.loadEffectiveFieldMap(mediaType);
		if (!fieldMap || fieldMap.syncFields.length === 0) {
			new Notice(tr('sync-nothing'));
			return result;
		}
		const enabledFields = fieldMap.syncFields.filter((f) => f.sync);
		if (enabledFields.length === 0) {
			new Notice(tr('sync-nothing'));
			return result;
		}

		// 2. find local notes
		const mediaSettings = this.plugin.settings.media[mediaType];
		const folder = mediaSettings?.folder || `Content/${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}`;
		const notes = this.scanFolder(folder);

		// 3. compare
		for (const [sourceId, file] of notes) {
			const remote = remoteData.get(sourceId);
			if (!remote) continue;

			const content = await this.app.vault.read(file);
			const fm = parseFrontmatter(content);
			const ignoredFields = this.ignoreStore.getIgnoredFields(sourceId);

			const changes: SyncFieldChange[] = [];

			for (const sf of enabledFields) {
				if (ignoredFields.includes(sf.key)) continue;
				if (sf.sync === false) continue;

				const localRaw = resolveFrontmatterValue(fm, sf.property, sf.key);
				const remoteRaw = remote[sf.key] ?? null;

				const localVal = this.coerceValue(localRaw, sf.type);
				const remoteVal = this.coerceValue(remoteRaw, sf.type);

				if (!this.valuesEqual(localVal, remoteVal, sf.type)) {
					changes.push({
						fieldKey: sf.key,
						propertyName: sf.property,
						localValue: localVal,
						remoteValue: remoteVal,
					});
				}
			}

			// grab title from frontmatter or use filename
			const title = (fm['title'] as string) ?? file.basename;

			if (changes.length > 0) {
				result.changes.push({
					sourceId,
					title,
					filePath: file.path,
					changes,
				});
			}
		}

		return result;
	}

	// apply a set of changes to vault files
	async applyChanges(changes: NoteSyncChange[], fieldMap: SyncFieldMap): Promise<void> {
		for (const noteChange of changes) {
			const file = this.app.vault.getAbstractFileByPath(noteChange.filePath);
			if (!file || !(file instanceof TFile)) continue;

			const content = await this.app.vault.read(file);
			const fm = parseFrontmatter(content);
			const updates: Record<string, string | number | boolean | null> = {};

			for (const change of noteChange.changes) {
				const sf = fieldMap.syncFields.find((f) => f.key === change.fieldKey);
				const propertyName = sf?.property ?? change.fieldKey;

				updates[propertyName] = change.remoteValue;

				// cleanup old key if property name differs
				if (propertyName !== change.fieldKey && fm[change.fieldKey] !== undefined) {
					updates[change.fieldKey] = null;
				}
			}

			updates['lastSyncAt'] = new Date().toISOString();

			const newContent = updateFrontmatter(content, updates);
			await this.app.vault.modify(file, newContent);
		}
	}

	// apply a single note's changes
	async applyNoteChanges(
		file: TFile,
		changes: SyncFieldChange[],
		fieldMap: SyncFieldMap,
	): Promise<void> {
		const content = await this.app.vault.read(file);
		const fm = parseFrontmatter(content);
		const updates: Record<string, string | number | boolean | null> = {};

		for (const change of changes) {
			const sf = fieldMap.syncFields.find((f) => f.key === change.fieldKey);
			const propertyName = sf?.property ?? change.fieldKey;
			updates[propertyName] = change.remoteValue;
			if (propertyName !== change.fieldKey && fm[change.fieldKey] !== undefined) {
				updates[change.fieldKey] = null;
			}
		}

		updates['lastSyncAt'] = new Date().toISOString();
		const newContent = updateFrontmatter(content, updates);
		await this.app.vault.modify(file, newContent);
	}

	private async loadEffectiveFieldMap(mediaType: MediaType): Promise<SyncFieldMap | null> {
		// try loading the JSON sidecar from the template folder
		const mapPath = `${this.plugin.settings.templateFolder}/${makeFieldMapPath(mediaType)}`;
		const map = await loadFieldMap(this.app, mapPath);
		if (map) return map;

		// fallback: generate from registry (personal fields only)
		return getDefaultFieldMap(mediaType);
	}

	private scanFolder(folder: string): Map<string, TFile> {
		const files = this.app.vault.getFiles();
		const result = new Map<string, TFile>();
		for (const file of files) {
			if (!file.path.startsWith(folder)) continue;
			const sourceId = extractSourceId(file.name);
			if (sourceId) result.set(sourceId, file);
		}
		return result;
	}

	private coerceValue(
		val: string | number | boolean | null | undefined,
		type: string,
	): string | number | null {
		if (val === null || val === undefined) return null;
		if (type === 'number') {
			const n = Number(val);
			return isNaN(n) ? null : n;
		}
		if (type === 'boolean') return val ? 'true' : 'false';
		if (type === 'date') {
			// date objects from anilist come as { year, month, day } or YYYY-MM-DD string
			if (typeof val === 'object') {
				const d = val as { year?: number; month?: number; day?: number };
				const y = d.year ?? 0;
				const m = d.month ?? 0;
				const day = d.day ?? 0;
				return y > 0 ? `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
			}
			return String(val);
		}
		return String(val);
	}

	private valuesEqual(
		a: string | number | null,
		b: string | number | null,
		type: string,
	): boolean {
		if (a === b) return true;
		if (a === null && b === null) return true;
		if (a === null || b === null) return false;
		if (type === 'number') {
			// small tolerance for floating point
			return Math.abs(Number(a) - Number(b)) < 0.01;
		}
		return String(a).toLowerCase() === String(b).toLowerCase();
	}
}
