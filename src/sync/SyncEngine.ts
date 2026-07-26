import { App, Notice, TFile } from 'obsidian';
import type { MediaType } from '../types';
import { tr } from '../i18n';
import type { SyncFieldMap, SyncFieldChange, NoteSyncChange, SyncResult } from './types';
import { loadFieldMap, getDefaultFieldMap, makeFieldMapPath } from './SyncFieldMap';
import { NoteIgnoreStore } from './NoteIgnoreStore';
import type BabylonPlugin from '../main';

const SOURCE_ID_RE = / - (\d+)\.md$/;

export function extractSourceId(filename: string): string | null {
	const m = filename.match(SOURCE_ID_RE);
	return m?.[1] ?? null;
}

export function readFrontmatter(app: App, file: TFile): Record<string, unknown> {
	const meta = app.metadataCache.getFileCache(file);
	return meta?.frontmatter ?? {};
}

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

	async syncAll(
		mediaType: MediaType,
		remoteData: RemoteDataMap,
	): Promise<SyncResult> {
		const result: SyncResult = { mediaType, changes: [] };

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

		const mediaSettings = this.plugin.settings.media[mediaType];
		const folder = mediaSettings?.folder || `Content/${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}`;
		const notes = this.scanFolder(folder);

		for (const [sourceId, file] of notes) {
			const remote = remoteData.get(sourceId);
			if (!remote) continue;

			const fm = readFrontmatter(this.app, file);
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

			if (changes.length > 0) {
				const title = (fm['title'] as string) ?? file.basename;
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

	async applyChanges(changes: NoteSyncChange[], fieldMap: SyncFieldMap): Promise<void> {
		for (const noteChange of changes) {
			const file = this.app.vault.getAbstractFileByPath(noteChange.filePath);
			if (!file || !(file instanceof TFile)) continue;

			const fm = readFrontmatter(this.app, file);
			const updates: Record<string, string | number | boolean | null> = {};

			for (const change of noteChange.changes) {
				const sf = fieldMap.syncFields.find((f) => f.key === change.fieldKey);
				const propertyName = sf?.property ?? change.fieldKey;

				updates[propertyName] = change.remoteValue;

				if (propertyName !== change.fieldKey && fm[change.fieldKey] !== undefined) {
					updates[change.fieldKey] = null;
				}
			}

			updates['lastSyncAt'] = new Date().toISOString();

			await applySurgicalFrontmatterUpdates(this.app, file, updates);
		}
	}

	async applyNoteChanges(
		file: TFile,
		changes: SyncFieldChange[],
		fieldMap: SyncFieldMap,
	): Promise<void> {
		const fm = readFrontmatter(this.app, file);
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
		await applySurgicalFrontmatterUpdates(this.app, file, updates);
	}

	private async loadEffectiveFieldMap(mediaType: MediaType): Promise<SyncFieldMap | null> {
		const mapPath = `${this.plugin.settings.templateFolder}/${makeFieldMapPath(mediaType)}`;
		const map = await loadFieldMap(this.app, mapPath);
		if (map) return map;
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
			return Math.abs(Number(a) - Number(b)) < 0.01;
		}
		return String(a).toLowerCase() === String(b).toLowerCase();
	}
}

function resolveFrontmatterValue(
	fm: Record<string, unknown>,
	property: string,
	key: string,
): string | number | null {
	const val = getNestedValue(fm, property);
	if (val !== undefined) return val as string | number;

	if (key !== property) {
		const keyVal = getNestedValue(fm, key);
		if (keyVal !== undefined) return keyVal as string | number;
	}

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

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	if (!path.includes('.')) return obj[path];
	const parts = path.split('.');
	let current: unknown = obj;
	for (const part of parts) {
		if (current === null || current === undefined || typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

// Surgical frontmatter editor: updates only the specific lines that changed,
// preserving all existing formatting (quotes, comments, array layout, etc.).
async function applySurgicalFrontmatterUpdates(
	app: App,
	file: TFile,
	updates: Record<string, string | number | boolean | null>,
): Promise<void> {
	const content = await app.vault.read(file);

	const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (!fmMatch) return;

	const rawFm = fmMatch[1]!;
	const body = content.slice(fmMatch[0].length);

	const lines = rawFm.split('\n');
	const seenKeys = new Set<string>();

	for (const [key, val] of Object.entries(updates)) {
		const lineIdx = findTopLevelKeyLine(lines, key);
		const serialized = serializeYamlValue(key, val);

		if (lineIdx !== -1) {
			lines[lineIdx] = serialized;
		} else {
			lines.push(serialized);
		}
		seenKeys.add(key);
	}

	const newFm = lines.join('\n');
	const newContent = '---\n' + newFm + '\n---\n' + body;
	await app.vault.modify(file, newContent);
}

// Find the line index of a top-level key, skipping indented children.
function findTopLevelKeyLine(lines: string[], key: string): number {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		const m = line.match(/^(\w+):/);
		if (m && m[1] === key) return i;
	}
	return -1;
}

// Serialize a single key:value pair for a simple scalar value.
// Preserves the original quoting from the existing line where possible,
// otherwise uses best-practice YAML quoting for safety.
function serializeYamlValue(key: string, val: string | number | boolean | null): string {
	if (val === null || val === undefined) {
		return `${key}: `;
	}

	if (typeof val === 'number') {
		return `${key}: ${val}`;
	}

	if (typeof val === 'boolean') {
		return `${key}: ${val ? 'true' : 'false'}`;
	}

	// string — quote if it contains yaml-significant characters
	if (needsYamlQuoting(val)) {
		return `${key}: "${escapeYamlDoubleQuotes(val)}"`;
	}

	return `${key}: ${val}`;
}

function needsYamlQuoting(s: string): boolean {
	if (s.length === 0) return true;
	// already quoted
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return false;
	// yaml-significant characters
	if (/[[\]{}:,*&?!|<>'"%@`#]/.test(s)) return true;
	if (/^[^a-zA-Z0-9]/.test(s)) return true;
	if (s.includes('  ')) return true;
	return false;
}

function escapeYamlDoubleQuotes(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
