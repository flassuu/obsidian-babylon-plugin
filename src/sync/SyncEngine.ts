import { App, Notice, TFile } from 'obsidian';
import type { MediaType } from '../types';
import { tr } from '../i18n';
import type { SyncFieldMap, SyncFieldChange, NoteSyncChange, SyncResult } from './types';
import { loadFieldMap, getDefaultFieldMap, makeFieldMapPath } from './SyncFieldMap';
import { NoteIgnoreStore } from './NoteIgnoreStore';
import {
	loadPresets,
	resolveActivePreset,
	makePresetPath,
	PresetFormatter,
	remoteKeyFor,
	type FieldFormat,
} from '../presets';
import { serializeYamlValue } from '../utils/yaml';
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

// a field compared during sync: where the value lives remotely, where it is
// stored in frontmatter, and how to format it before comparison.
interface SyncTarget {
	apiKey: string;
	property: string;
	type: string;
	format?: FieldFormat;
}

export class SyncEngine {
	private app: App;
	private plugin: BabylonPlugin;
	private ignoreStore: NoteIgnoreStore;
	private formatter = new PresetFormatter();

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

		const targets = await this.loadEffectiveTargets(mediaType);
		if (!targets || targets.length === 0) {
			new Notice(tr('sync-nothing'));
			return result;
		}

		this.debug(`syncAll: ${targets.length} enabled`, targets.map(t => t.apiKey));

		const mediaSettings = this.plugin.settings.media[mediaType];
		const folder = mediaSettings?.folder || `Content/${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}`;
		const notes = this.scanFolder(folder);
		this.debug(`syncAll: ${notes.size} notes, ${remoteData.size} remote`);

		// process scalar fields first, the whole advancedScores object last
		const scalarTargets = targets.filter((t) => t.apiKey !== 'advancedScores');
		const advTarget = targets.find((t) => t.apiKey === 'advancedScores');

		for (const [sourceId, file] of notes) {
			const remote = remoteData.get(sourceId);
			if (!remote) {
				this.debug(`syncAll: no remote for ${sourceId} (${file.path})`);
				continue;
			}

			const fm = readFrontmatter(this.app, file);
			if (Object.keys(fm).length === 0) {
				this.debug(`syncAll: empty fm for ${file.path}`);
			}
			const ignoredFields = this.ignoreStore.getIgnoredFields(sourceId);

			const changes: SyncFieldChange[] = [];

			this.debug('cmp', `${file.name} remote keys:`, Object.keys(remote));

			for (const target of scalarTargets) {
				if (ignoredFields.includes(target.apiKey)) {
					this.debug('cmp', `SKIP ${target.apiKey} (ignored)`);
					continue;
				}

				const localRaw = resolveFrontmatterValue(fm, target.property, target.apiKey);
				const remoteRaw = remote[target.apiKey] ?? null;

				this.debug('cmp', `RAW ${target.apiKey}: localRaw=${localRaw} remoteRaw=${remoteRaw} type=${target.type} prop=${target.property}`);

				// local files already hold formatted values, so format the remote
				// side the same way before comparing
				const formatted = this.formatter.apply(remoteRaw, target.format);
				const localVal = this.coerceValue(localRaw, target.type);
				const remoteVal = this.coerceValue(formatted, target.type);

				const eq = this.valuesEqual(localVal, remoteVal, target.type);
				this.debug('cmp', `${file.name} ${target.apiKey}: L=${localVal} R=${remoteVal} ${eq?'eq':'★'}`);

				if (!eq) {
					changes.push({
						fieldKey: target.apiKey,
						propertyName: target.property,
						localValue: localVal,
						remoteValue: remoteVal,
					});
				}
			}

			if (advTarget) {
				this.collectAdvancedScoreChanges(changes, fm, remote, ignoredFields, advTarget.property);
			}

			if (changes.length > 0) {
				const title = (fm['title'] as string) ?? file.basename;
				result.changes.push({
					sourceId,
					title,
					filePath: file.path,
					changes,
				});
				this.debug(`syncAll: ${changes.length} changes for ${title}`);
			}
		}

		this.debug(`syncAll: ${result.changes.length} notes with changes`);
		return result;
	}

	private debug(...args: unknown[]): void {
		console.warn('[Babylon]', ...args);
	}

	async applyChanges(changes: NoteSyncChange[]): Promise<void> {
		for (const noteChange of changes) {
			const file = this.app.vault.getAbstractFileByPath(noteChange.filePath);
			if (!file || !(file instanceof TFile)) continue;

			const fm = readFrontmatter(this.app, file);
			const updates: Record<string, string | number | boolean | null> = {};

			for (const change of noteChange.changes) {
				// propertyName already carries the target frontmatter key; clean up
				// the old key when a field was renamed
				updates[change.propertyName] = change.remoteValue;
				if (change.propertyName !== change.fieldKey && fm[change.fieldKey] !== undefined) {
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
	): Promise<void> {
		const fm = readFrontmatter(this.app, file);
		const updates: Record<string, string | number | boolean | null> = {};

		for (const change of changes) {
			updates[change.propertyName] = change.remoteValue;
			if (change.propertyName !== change.fieldKey && fm[change.fieldKey] !== undefined) {
				updates[change.fieldKey] = null;
			}
		}

		updates['lastSyncAt'] = new Date().toISOString();
		await applySurgicalFrontmatterUpdates(this.app, file, updates);
	}

	// resolve the sync field list: active preset first, legacy field map as fallback
	private async loadEffectiveTargets(mediaType: MediaType): Promise<SyncTarget[] | null> {
		const presetPath = `${this.plugin.settings.templateFolder}/${makePresetPath(mediaType)}`;
		const collection = await loadPresets(this.app, presetPath);
		const preset = resolveActivePreset(collection);
		if (preset) {
			return preset.fields
				.filter((f) => f.sync)
				.map((f) => ({
					apiKey: remoteKeyFor(f.apiKey),
					property: f.property,
					type: f.type,
					format: f.format,
				}));
		}

		const mapPath = `${this.plugin.settings.templateFolder}/${makeFieldMapPath(mediaType)}`;
		const map = await this.loadLegacyFieldMap(mediaType, mapPath);
		if (!map || map.syncFields.length === 0) return null;
		const enabled = map.syncFields.filter((sf) => sf.sync);
		return enabled.map((sf) => ({
			apiKey: sf.key,
			property: sf.property,
			type: sf.type,
		}));
	}

	private async loadLegacyFieldMap(mediaType: MediaType, mapPath: string): Promise<SyncFieldMap | null> {
		const map = await loadFieldMap(this.app, mapPath);
		return map ?? getDefaultFieldMap(mediaType);
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

	// expand the whole advancedScores object into individual sub-field changes
	// (legacy field-map mode — presets model sub-fields as individual entries)
	private collectAdvancedScoreChanges(
		changes: SyncFieldChange[],
		fm: Record<string, unknown>,
		remote: RemoteEntryValues,
		ignoredFields: string[],
		property: string,
	): void {
		for (const [remoteKey, remoteRaw] of Object.entries(remote)) {
			if (!remoteKey.startsWith('advancedScores.')) continue;
			if (ignoredFields.includes(remoteKey)) continue;
			const subKey = remoteKey.slice('advancedScores.'.length);
			if (fm[subKey] === undefined) continue;

			const localVal = this.coerceValue(fm[subKey] as string | number | boolean | null | undefined, 'number');
			const remoteVal = this.coerceValue(remoteRaw, 'number');
			const eq = this.valuesEqual(localVal, remoteVal, 'number');
			this.debug('ascore', `${subKey}: L=${localVal} R=${remoteVal} ${eq?'eq':'★'}`);
			if (!eq) {
				changes.push({
					fieldKey: remoteKey,
					propertyName: subKey,
					localValue: localVal,
					remoteValue: remoteVal,
				});
			}
		}
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
			if (typeof val === 'object' && !Array.isArray(val)) {
				if ('getFullYear' in (val as Record<string, unknown>)) {
					const dt = val as Date;
					const y = dt.getFullYear();
					const mo = dt.getMonth() + 1;
					const da = dt.getDate();
					return y > 0 ? `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}` : null;
				}
				const ymd = val as { year?: number; month?: number; day?: number };
				const y = ymd.year ?? 0;
				const mo = ymd.month ?? 0;
				const da = ymd.day ?? 0;
				return y > 0 ? `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}` : null;
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
	let content: string;
	try {
		content = await app.vault.read(file);
	} catch (err) {
		console.error('[Babylon] applySurgical: failed to read', file.path, err);
		return;
	}

	const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (!fmMatch) {
		console.warn('[Babylon] applySurgical: no frontmatter in', file.path);
		return;
	}

	const rawFm = fmMatch[1]!;
	const body = content.slice(fmMatch[0].length);

	const lines = rawFm.split('\n');

	for (const [key, val] of Object.entries(updates)) {
		const lineIdx = findTopLevelKeyLine(lines, key);
		const serialized = serializeYamlValue(key, val);

		if (lineIdx !== -1) {
			lines[lineIdx] = serialized;
		} else {
			lines.push(serialized);
		}
	}

	const newFm = lines.join('\n');
	const newContent = '---\n' + newFm + '\n---\n' + body;

	try {
		await app.vault.modify(file, newContent);
		console.debug('[Babylon] applySurgical: wrote updates to', file.path, Object.keys(updates));
	} catch (err) {
		console.error('[Babylon] applySurgical: failed to write', file.path, err);
	}
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
