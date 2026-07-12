import type { ContentProvider, MediaDetails, MediaType, ProviderId, SearchResult } from '../types';
import { fetchJson } from '../utils/fetcher';
import { stripHtml } from '../utils/sanitize';

const ANILIST_API = 'https://graphql.anilist.co';

const BASE_SEARCH_FIELDS = `
  id
  title { romaji english native }
  coverImage { large }
  seasonYear
  format
  episodes
  averageScore
  genres
  description
  siteUrl
  status
`.trim();

const BASE_DETAIL_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large medium color }
  bannerImage
  seasonYear
  season
  format
  status
  episodes
  duration
  description
  averageScore
  meanScore
  popularity
  favourites
  genres
  tags { id name description category rank isAdult }
  synonyms
  source(version: 3)
  countryOfOrigin
  isAdult
  hashtag
  trailer { id site thumbnail }
  studios (isMain: true) { nodes { id name } }
  externalLinks { id url site }
  streamingEpisodes { title url site }
  rankings { id rank type format year season allTime context }
  siteUrl
  updatedAt
`.trim();

function buildSearchQuery(extraFields: string): string {
	const extra = extraFields ? `\n    ${extraFields}` : '';
	return `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: ANIME) {
      ${BASE_SEARCH_FIELDS}${extra}
    }
  }
}`;
}

function buildDetailQuery(extraFields: string): string {
	const extra = extraFields ? `\n    ${extraFields}` : '';
	return `
query ($id: Int) {
  Media(id: $id) {
    ${BASE_DETAIL_FIELDS}${extra}
    mediaListEntry {
      id
      status
      score
      progress
      progressVolumes
      repeat
      notes
      startedAt { year month day }
      completedAt { year month day }
    }
  }
}`;
}

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

	private customFields = '';
	private accessToken = '';

	setCustomFields(fields: string): void {
		this.customFields = fields.trim();
	}

	setAccessToken(token: string): void {
		this.accessToken = token;
	}

	private getToken(): string | undefined {
		return this.accessToken || undefined;
	}

	async search(query: string): Promise<SearchResult[]> {
		const q = buildSearchQuery(this.customFields);
		const data = await fetchJson(ANILIST_API, 'POST', JSON.stringify({
			query: q,
			variables: { search: query, page: 1, perPage: 20 },
		}), this.getToken()) as Record<string, unknown>;

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

		const q = buildDetailQuery(this.customFields);
		const data = await fetchJson(ANILIST_API, 'POST', JSON.stringify({
			query: q,
			variables: { id },
		}), this.getToken()) as Record<string, unknown>;

		const media = (data['data'] as Record<string, unknown>)?.['Media'] as Record<string, unknown> ?? null;
		if (!media) return null;

		const title = media['title'] as Record<string, string>;
		const studios = media['studios'] as Record<string, unknown> ?? {};
		const studioNodes = (studios['nodes'] as Array<Record<string, string>>) ?? [];
		const studioNames = studioNodes.map((n) => n['name']).filter(Boolean) as string[];

		const details: MediaDetails = {
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
		};

		const extraKeys = [
			'id', 'idMal', 'type', 'status', 'season', 'duration',
			'bannerImage', 'averageScore', 'meanScore', 'popularity', 'favourites',
			'hashtag', 'countryOfOrigin', 'isAdult', 'source', 'synonyms', 'updatedAt',
		];
		for (const key of extraKeys) {
			if (media[key] !== undefined) {
				details[key] = media[key];
			}
		}

		const tags = media['tags'] as Array<Record<string, unknown>> | undefined;
		if (tags) {
			details['tagNames'] = tags.map((t) => t['name']).filter(Boolean).join(', ');
		}

		const coverImg = media['coverImage'] as Record<string, unknown> | undefined;
		if (coverImg) {
			details['coverExtraLarge'] = coverImg['extraLarge'] ?? null;
			details['coverMedium'] = coverImg['medium'] ?? null;
			details['coverColor'] = coverImg['color'] ?? null;
		}

		if (this.customFields) {
			const fieldNames = this.customFields
				.split('\n')
				.map((f) => f.trim())
				.filter((f) => f.length > 0 && !f.includes('{'));
			for (const field of fieldNames) {
				const simpleName = field.replace(/[^a-zA-Z0-9_]/g, '');
				if (simpleName && media[simpleName] !== undefined) {
					details[simpleName] = media[simpleName];
				}
			}
		}

		return details;
	}
}
