import type { BabylonSettings } from '../types';

export const DEFAULT_SETTINGS: BabylonSettings = {
	language: 'en',
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
		},
		movie: {
			enabled: true,
			folder: 'Content/Movies',
			provider: null,
			templatePath: '',
		},
		series: {
			enabled: false,
			folder: 'Content/Series',
			provider: null,
			templatePath: '',
		},
	},
};
