import type { MediaType } from '../types';
import { getFields } from '../fields/FieldRegistry';
import type { FieldDefinition } from '../fields/types';
import type { FieldFormat, MediaPreset, PresetField } from './types';
import { makeFieldId } from './types';

// default formatting applied per field when building a fresh preset
function defaultFormatFor(def: FieldDefinition): FieldFormat | undefined {
	if (def.type === 'date') {
		return { dateFormat: 'YYYY-MM-DD' };
	}
	if (def.key === 'myStatus') {
		return { case: 'capitalize' };
	}
	return undefined;
}

// a fresh default preset from the FieldRegistry: core/always fields first
// (read-only, sync off) then personal tracking fields (sync on).
// sourceId/provider are appended as non-sync identity fields since the
// registry has no definitions for them but every note needs them.
export function buildDefaultPreset(mediaType: MediaType, name = 'Main'): MediaPreset {
	const fields = getFields(mediaType);
	const result: PresetField[] = [];

	for (const def of fields) {
		if (!def.always && !def.personal) continue;
		result.push({
			id: makeFieldId(),
			apiKey: def.key,
			property: def.key,
			type: def.type,
			order: result.length,
			sync: !!def.personal,
			format: defaultFormatFor(def),
		});
	}

	for (const [apiKey, type] of [['sourceId', 'number'], ['provider', 'string']] as const) {
		result.push({
			id: makeFieldId(),
			apiKey,
			property: apiKey,
			type,
			order: result.length,
			sync: false,
		});
	}

	return { name, isDefault: true, fields: result };
}

// pick a unique preset name, appending " (copy)" when needed
export function makeCopyName(presetName: string): string {
	return `${presetName} (copy)`;
}
