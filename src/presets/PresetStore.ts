import { App, TFile } from 'obsidian';
import type { MediaType } from '../types';
import type { MediaPreset, PresetCollection } from './types';
import { PRESET_COLLECTION_VERSION } from './types';

export function makePresetPath(mediaType: MediaType): string {
	return `${mediaType}.preset.json`;
}

export function makeCollection(mediaType: MediaType, presets: MediaPreset[]): PresetCollection {
	return { version: PRESET_COLLECTION_VERSION, mediaType, presets };
}

export async function loadPresets(app: App, vaultPath: string): Promise<PresetCollection | null> {
	const file = app.vault.getAbstractFileByPath(vaultPath);
	if (!file || !(file instanceof TFile)) return null;
	const raw = await app.vault.read(file);
	try {
		const parsed = JSON.parse(raw) as PresetCollection;
		if (!parsed.version || !parsed.mediaType || !Array.isArray(parsed.presets)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export async function savePresets(
	app: App,
	vaultPath: string,
	collection: PresetCollection,
): Promise<void> {
	const content = JSON.stringify(collection, null, 2);
	const existing = app.vault.getAbstractFileByPath(vaultPath);
	if (existing && existing instanceof TFile) {
		await app.vault.modify(existing, content);
	} else {
		await app.vault.create(vaultPath, content);
	}
}

// resolve the preset used for creation/sync: the marked default, or the first one.
// returns null when there are no presets at all.
export function resolveActivePreset(collection: PresetCollection | null): MediaPreset | null {
	if (!collection || collection.presets.length === 0) return null;
	const def = collection.presets.find((p) => p.isDefault);
	return def ?? collection.presets[0] ?? null;
}

// ensure at most one preset is marked as default inside the collection
export function ensureSingleDefault(collection: PresetCollection, keepName: string): void {
	for (const p of collection.presets) {
		p.isDefault = p.name === keepName;
	}
}
