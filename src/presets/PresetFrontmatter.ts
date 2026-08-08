import type { MediaDetails } from '../types';
import type { MediaPreset } from './types';
import { PresetFormatter } from './PresetFormatter';
import { detailsKeyFor, isAdvancedScoreKey } from './types';
import { serializeYamlValue, serializeYamlListLines } from '../utils/yaml';

function camelSubKey(apiKey: string): string {
	return apiKey.slice('advancedScores.'.length);
}

// resolve the raw value for an apiKey from MediaDetails.
// advancedScores.<sub> keys map to the provider's flat "advancedScore_<camel>"
// keys, with a fallback scan of the raw advancedScores object.
export function resolveDetailsValue(details: MediaDetails, apiKey: string): unknown {
	if (isAdvancedScoreKey(apiKey)) {
		const flatKey = detailsKeyFor(apiKey);
		if (details[flatKey] !== undefined) return details[flatKey];

		const adv = details['advancedScores'];
		if (adv && typeof adv === 'object') {
			const target = camelSubKey(apiKey);
			for (const [k, v] of Object.entries(adv as Record<string, unknown>)) {
				if (k === target) return v;
			}
		}
		return undefined;
	}
	return details[apiKey];
}

// build the ordered YAML frontmatter block (without the surrounding ---) from a
// preset. fields without a value are omitted (v1 behavior).
export function buildFrontmatter(details: MediaDetails, preset: MediaPreset): string {
	const formatter = new PresetFormatter();
	const fields = [...preset.fields].sort((a, b) => a.order - b.order);
	const lines: string[] = [];

	for (const f of fields) {
		const raw = resolveDetailsValue(details, f.apiKey);
		if (raw === undefined || raw === null) continue;

		if (f.type === 'array') {
			const arr = Array.isArray(raw) ? raw : [raw];
			if (arr.length === 0) continue;
			lines.push(serializeYamlListLines(f.property, arr));
			continue;
		}

		if (f.type === 'object') {
			// complex objects are not serialized in v1 - skip them
			continue;
		}

		const formatted = formatter.apply(raw, f.format);
		if (formatted === null) continue;
		lines.push(serializeYamlValue(f.property, formatted));
	}

	return lines.join('\n');
}
