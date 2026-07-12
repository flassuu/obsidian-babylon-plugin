import type { ContentProvider, MediaDetails, MediaType, ProviderId, SearchResult } from '../types';
import { fetchJson } from '../utils/fetcher';
import { stripHtml } from '../utils/sanitize';

const ANILIST_API = 'https://graphql.anilist.co';

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: ANIME) {
      id
      title { romaji english native }
      coverImage { large }
      seasonYear
      format
      episodes
      averageScore
      genres
      studios { nodes { name } }
      description
      siteUrl
      status
    }
  }
}`;

const DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    title { romaji english native }
    coverImage { large }
    seasonYear
    format
    episodes
    averageScore
    genres
    studios { nodes { name } }
    description
    siteUrl
    status
    popularity
    meanScore
  }
}`;

function pickTitle(title: { romaji?: string; english?: string; native?: string }): string {
	return title.english ?? title.romaji ?? title.native ?? 'Unknown';
}

function pickOriginalTitle(title: { romaji?: string; english?: string; native?: string }): string {
	return title.romaji ?? title.native ?? title.english ?? 'Unknown';
}

export class AnilistProvider implements ContentProvider {
	id: ProviderId = 'anilist';
	mediaTypes: MediaType[] = ['anime'];
	requiresKey = false;

	async search(query: string): Promise<SearchResult[]> {
		const data = await fetchJson(ANILIST_API, 'POST', JSON.stringify({
			query: SEARCH_QUERY,
			variables: { search: query, page: 1, perPage: 20 },
		})) as Record<string, unknown>;

		const page = data['data'] as Record<string, unknown>;
		const pageObj = page?.['Page'] as Record<string, unknown>;
		const mediaList = pageObj?.['media'] as Array<Record<string, unknown>> ?? [];

		return mediaList.map((media) => ({
			provider: 'anilist',
			sourceId: String(media['id']),
			title: pickTitle(media['title'] as Record<string, string>),
			year: (media['seasonYear'] as number) ?? null,
			subtitle: (media['format'] as string) ?? null,
			cover: (media['coverImage'] as Record<string, string>)?.['large'] ?? null,
			raw: media,
		}));
	}

	async fetchDetails(sourceId: string, raw?: unknown): Promise<MediaDetails | null> {
		const id = raw
			? (raw as Record<string, unknown>)['id']
			: parseInt(sourceId, 10);

		const data = await fetchJson(ANILIST_API, 'POST', JSON.stringify({
			query: DETAIL_QUERY,
			variables: { id },
		})) as Record<string, unknown>;

		const media = (data['data'] as Record<string, unknown>)?.['Media'] as Record<string, unknown> ?? null;
		if (!media) return null;

		const title = media['title'] as Record<string, string>;
		const studios = media['studios'] as Record<string, unknown> ?? {};
		const studioNodes = (studios['nodes'] as Array<Record<string, string>>) ?? [];
		const studioNames = studioNodes.map((n) => n['name']).filter(Boolean) as string[];

		return {
			title: pickTitle(title),
			originalTitle: pickOriginalTitle(title),
			year: (media['seasonYear'] as number) ?? null,
			description: media['description'] ? stripHtml(media['description'] as string) : null,
			cover: (media['coverImage'] as Record<string, string>)?.['large'] ?? null,
			genres: (media['genres'] as string[]) ?? [],
			creators: studioNames,
			rating: (media['averageScore'] as number) ?? null,
			url: (media['siteUrl'] as string) ?? null,
			format: (media['format'] as string) ?? null,
			progressTotal: (media['episodes'] as number) ?? null,
			sourceId: String(media['id']),
			provider: 'anilist',
			status: media['status'] ?? null,
			popularity: media['popularity'] ?? null,
		};
	}
}
