export type MediaType = 'anime' | 'movie' | 'series' | 'game' | 'book' | 'custom';

export type ProviderId = 'anilist' | 'omdb' | 'steam' | 'rawg' | 'howlongtobeat' | 'openlibrary' | 'googlebooks';

export type SupportedLocale = 'en' | 'ru';

export type TemplateMode = 'simple' | 'advanced';

export interface MediaTypeSettings {
	enabled: boolean;
	folder: string;
	provider: ProviderId | null;
	templatePath: string;
}

export interface AnilistAuthSettings {
	personalizationEnabled: boolean;
	accessToken: string;
	customFields: string;
	customFieldsPublic: string;
	customFieldsPrivate: string;
}

export interface AnilistSyncSettings {
	enabled: boolean;
	syncOnStartup: boolean;
	twoWaySync: boolean;
}

export interface BabylonSettings {
	language: SupportedLocale;
	apiKeys: {
		omdb: string;
		rawg: string;
		googleBooks: string;
		steam: string;
	};
	anilistAuth: AnilistAuthSettings;
	anilistSync: AnilistSyncSettings;
	media: Partial<Record<MediaType, MediaTypeSettings>>;
}

export interface SearchResult {
	provider: ProviderId;
	sourceId: string;
	title: string;
	year: number | null;
	subtitle: string | null;
	cover: string | null;
	raw: unknown;
}

export interface MediaDetails {
	title: string;
	originalTitle: string | null;
	year: number | null;
	description: string | null;
	cover: string | null;
	genres: string[];
	creators: string[];
	rating: number | null;
	url: string | null;
	format: string | null;
	progressTotal: number | null;
	sourceId: string;
	provider: ProviderId;
	[key: string]: unknown;
}

export interface ContentProvider {
	id: ProviderId;
	mediaTypes: MediaType[];
	requiresKey: boolean;
	search(query: string): Promise<SearchResult[]>;
	fetchDetails(sourceId: string, raw?: unknown): Promise<MediaDetails | null>;
}

export interface SyncConflict {
	sourceId: string;
	title: string;
	localStatus: string | null;
	remoteStatus: string | null;
	localScore: number | null;
	remoteScore: number | null;
	localProgress: number | null;
	remoteProgress: number | null;
	localNote: string | null;
	remoteNote: string | null;
}

