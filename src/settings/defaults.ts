import type { BabylonSettings } from '../types';
import { getFieldByKey } from '../fields/FieldRegistry';

const DEFAULT_ANIME_SELECTED = [
	'title', 'year', 'genres', 'cover', 'format', 'episodes', 'status',
	'averageScore', 'meanScore',
	'progress', 'score', 'startedAt', 'completedAt', 'notes',
	'synonyms', 'tags',
];

export const DEFAULT_SETTINGS: BabylonSettings = {
	language: 'en',
	templateFolder: 'Templates',
	apiKeys: {
		omdb: '',
		rawg: '',
		googleBooks: '',
		steam: '',
	},
	anilistAuth: {
		personalizationEnabled: false,
		accessToken: '',
		customFields: '',
		customFieldsPublic: '',
		customFieldsPrivate: '',
	},
	anilistSync: {
		enabled: false,
		syncOnStartup: false,
		twoWaySync: true,
	},
	media: {
		anime: {
			enabled: true,
			folder: 'Content/Anime',
			provider: 'anilist',
			templatePath: '',
			selectedFields: DEFAULT_ANIME_SELECTED,
			customFieldNames: [],
			templateMode: 'simple',
		},
		movie: {
			enabled: true,
			folder: 'Content/Movies',
			provider: null,
			templatePath: '',
			selectedFields: [],
			customFieldNames: [],
			templateMode: 'simple',
		},
		series: {
			enabled: false,
			folder: 'Content/Series',
			provider: null,
			templatePath: '',
			selectedFields: [],
			customFieldNames: [],
			templateMode: 'simple',
		},
		game: {
			enabled: false,
			folder: 'Content/Games',
			provider: null,
			templatePath: '',
			selectedFields: [],
			customFieldNames: [],
			templateMode: 'simple',
		},
		book: {
			enabled: false,
			folder: 'Content/Books',
			provider: null,
			templatePath: '',
			selectedFields: [],
			customFieldNames: [],
			templateMode: 'simple',
		},
	},
};

function parseFieldList(text: string): string[] {
	return text.split('\n')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export function migrateSettings(settings: BabylonSettings, data: Partial<BabylonSettings>): void {
	const oldAuth = data.anilistAuth;
	if (!oldAuth) return;

	const oldPublic = oldAuth.customFieldsPublic;
	const oldPrivate = oldAuth.customFieldsPrivate;
	const oldCustom = oldAuth.customFields;

	const oldKeys = [
		...(oldPublic ? parseFieldList(oldPublic) : []),
		...(oldPrivate ? parseFieldList(oldPrivate) : []),
		...(oldCustom ? parseFieldList(oldCustom) : []),
	];

	if (oldKeys.length === 0) return;

	const knownKeys: string[] = [];
	const unknownKeys: string[] = [];

	for (const key of oldKeys) {
		const def = getFieldByKey('anime', key);
		if (def) {
			knownKeys.push(key);
		} else {
			unknownKeys.push(key);
		}
	}

	const animeSettings = settings.media.anime;
	if (animeSettings) {
		animeSettings.selectedFields = knownKeys;
		animeSettings.customFieldNames = unknownKeys;
		animeSettings.templateMode = 'simple';
	}

	settings.anilistAuth.customFields = '';
	settings.anilistAuth.customFieldsPublic = '';
	settings.anilistAuth.customFieldsPrivate = '';
}
