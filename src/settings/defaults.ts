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
		customFieldsPublic: `type
genres
format
status
episodes
seasonYear
averageScore
meanScore
duration
season
source
synonyms
trending
popularity`,
		customFieldsPrivate: `progress
score
startedAt
completedAt
notes
repeat
priority`,
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
		game: {
			enabled: false,
			folder: 'Content/Games',
			provider: null,
			templatePath: '',
		},
		book: {
			enabled: false,
			folder: 'Content/Books',
			provider: null,
			templatePath: '',
		},
	},
};
