import { App, TFile } from 'obsidian';
import type { MediaType } from '../types';
import { getFields } from '../fields/FieldRegistry';
import type { SyncFieldMap, SyncFieldSetting } from './types';

const FIELD_MAP_VERSION = 1;

// field types that map to sync-compatible scalar values
const SYNC_TYPES: Record<string, 'number' | 'string' | 'date' | 'boolean'> = {
	number: 'number',
	string: 'string',
	date: 'date',
	boolean: 'boolean',
};

export function getDefaultFieldMap(mediaType: MediaType): SyncFieldMap {
	const fields = getFields(mediaType);
	const syncFields: SyncFieldSetting[] = [];
	for (const f of fields) {
		if (!f.personal) continue;
		const syncType = SYNC_TYPES[f.type] ?? 'string';
		syncFields.push({
			key: f.key,
			property: f.key,
			type: syncType,
			sync: true,
		});
	}
	return { version: FIELD_MAP_VERSION, mediaType, syncFields };
}

export function makeFieldMapPath(mediaType: MediaType): string {
	return `${mediaType}-fields.json`;
}

export async function loadFieldMap(app: App, vaultPath: string): Promise<SyncFieldMap | null> {
	const file = app.vault.getAbstractFileByPath(vaultPath);
	if (!file || !(file instanceof TFile)) return null;
	const raw = await app.vault.read(file);
	try {
		const parsed = JSON.parse(raw) as SyncFieldMap;
		if (!parsed.version || !parsed.mediaType || !Array.isArray(parsed.syncFields)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export async function saveFieldMap(
	app: App,
	vaultPath: string,
	map: SyncFieldMap,
): Promise<void> {
	const content = JSON.stringify(map, null, 2);
	const existing = app.vault.getAbstractFileByPath(vaultPath);
	if (existing && existing instanceof TFile) {
		await app.vault.modify(existing, content);
	} else {
		await app.vault.create(vaultPath, content);
	}
}

export async function generateFieldMapFromTemplate(
	app: App,
	mediaType: MediaType,
	templatePath: string,
): Promise<SyncFieldMap | null> {
	const templateFile = app.vault.getAbstractFileByPath(templatePath);
	if (!templateFile || !(templateFile instanceof TFile)) return null;
	const templateContent = await app.vault.read(templateFile);

	const placeholderRegex = /\{\{(\w+)\}\}/g;
	const fieldMap = getDefaultFieldMap(mediaType);
	const seen = new Set<string>();
	const lines = templateContent.split('\n');

	let match: RegExpExecArray | null;
	while ((match = placeholderRegex.exec(templateContent)) !== null) {
		const fieldKey = match[1];
		if (!fieldKey || seen.has(fieldKey)) continue;
		seen.add(fieldKey);

		const lineIdx = lines.findIndex((l) => l.includes(`{{${fieldKey}}}`));
		if (lineIdx === -1) continue;

		const line = lines[lineIdx]!.trim();
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const propertyName = line.slice(0, colonIdx).trim();

		const allFields = getFields(mediaType);
		const def = allFields.find((f) => f.key === fieldKey);
		const syncType = def ? (SYNC_TYPES[def.type] ?? 'string') : 'string';

		const existing = fieldMap.syncFields.find((sf) => sf.key === fieldKey);
		if (existing) {
			existing.property = propertyName;
		} else {
			fieldMap.syncFields.push({
				key: fieldKey,
				property: propertyName,
				type: syncType,
				sync: def?.personal ?? false,
			});
		}
	}

	return fieldMap;
}
