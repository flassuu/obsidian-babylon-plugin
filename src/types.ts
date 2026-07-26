export type MediaType = 'anime' | 'movie' | 'series' | 'game' | 'book' | 'custom';

export type ProviderId = 'anilist' | 'omdb' | 'steam' | 'rawg' | 'howlongtobeat' | 'openlibrary' | 'googlebooks';

export type SupportedLocale = 'en' | 'ru';

export type TemplateMode = 'simple' | 'advanced';

export interface MediaTypeSettings {
	enabled: boolean;
	folder: string;
	provider: ProviderId | null;
	templatePath: string;
	selectedFields: string[];
	customFieldNames: string[];
	templateMode: TemplateMode;
}

export interface AnilistAuthSettings {
	personalizationEnabled: boolean;
	accessToken: string;
	customFields: string;
	customFieldsPublic: string;
	customFieldsPrivate: string;
}

export interface SyncSettings {
	enabled: boolean;
	syncOnStartup: boolean;
}

export interface BabylonSettings {
	language: SupportedLocale;
	templateFolder: string;
	apiKeys: {
		omdb: string;
		rawg: string;
		googleBooks: string;
		steam: string;
	};
	anilistAuth: AnilistAuthSettings;
	sync: SyncSettings;
	noteIgnoreOverrides: Record<string, string[]>;
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
	studios: string[];
	averageScore: number | null;
	siteUrl: string | null;
	format: string | null;
	episodes: number | null;
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
