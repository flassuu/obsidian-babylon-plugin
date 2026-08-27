import type { MediaType } from '../types';

export const PRESET_COLLECTION_VERSION = 1;

export type PresetFieldType = 'string' | 'number' | 'date' | 'boolean' | 'array' | 'object';

export type FieldCase = 'none' | 'lower' | 'upper' | 'capitalize' | 'title';

export type DateFormat = 'YYYY-MM-DD' | 'DD.MM.YYYY' | 'YYYY/MM/DD' | 'D MMM YYYY';

export interface NumberFormat {
	scaleFrom?: number;
	scaleTo?: number;
	round?: number;
}

// formatting flags applied to a raw API value when writing to frontmatter
// and when comparing remote values during sync
export interface FieldFormat {
	case?: FieldCase;
	valueMap?: Record<string, string>;
	dateFormat?: DateFormat;
	number?: NumberFormat;
}

export interface PresetField {
	id: string;
	// source key: a FieldRegistry key, a flat MediaDetails key, or advancedScores.<sub>
	apiKey: string;
	// frontmatter name in the file == template alias
	property: string;
	type: PresetFieldType;
	order: number;
	sync: boolean;
	format?: FieldFormat;
}

export interface MediaPreset {
	name: string;
	isDefault: boolean;
	fields: PresetField[];
	// optional .md template file that provides the note body for this preset;
	// falls back to the media-type template when unset
	template?: string;
}

// one JSON sidecar per media type holding all presets for that type
export interface PresetCollection {
	version: number;
	mediaType: MediaType;
	presets: MediaPreset[];
}

// make a reasonably unique field id for the editor
export function makeFieldId(): string {
	return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// normalize an arbitrary label to camelCase (e.g. advanced score sub-keys)
export function camelize(label: string): string {
	return label
		.replace(/&/g, ' and ')
		.replace(/[^a-zA-Z0-9\s]/g, '')
		.split(/\s+/)
		.filter(Boolean)
		.map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
		.join('');
}

const ADV_SCORE_PREFIX = 'advancedScores.';
const ADV_FLAT_PREFIX = 'advancedScore_';

// true when an apiKey refers to a single advanced-score sub-value
export function isAdvancedScoreKey(apiKey: string): boolean {
	return apiKey.startsWith(ADV_SCORE_PREFIX);
}

// remote data key used for sync lookups: "advancedScores.Story" -> "advancedScores.story"
export function remoteKeyFor(apiKey: string): string {
	if (!isAdvancedScoreKey(apiKey)) return apiKey;
	return `${ADV_SCORE_PREFIX}${camelize(apiKey.slice(ADV_SCORE_PREFIX.length))}`;
}

// flat MediaDetails key the provider exposes: "advancedScores.Story" -> "advancedScore_story"
export function detailsKeyFor(apiKey: string): string {
	if (!isAdvancedScoreKey(apiKey)) return apiKey;
	return `${ADV_FLAT_PREFIX}${camelize(apiKey.slice(ADV_SCORE_PREFIX.length))}`;
}
