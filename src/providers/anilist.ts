import type { ContentProvider, MediaDetails, MediaType, ProviderId, SearchResult } from '../types';
import { fetchJson } from '../utils/fetcher';
import { stripHtml } from '../utils/sanitize';
import { getFields } from '../fields/FieldRegistry';

const ANILIST_API = 'https://graphql.anilist.co';

// fields always needed for search results
const SEARCH_GRAPHQL = `
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

// fields always needed for detail result (core rendering)
const ALWAYS_DETAIL_GRAPHQL = `
  id
  title { romaji english native }
  coverImage { extraLarge large medium color }
  seasonYear
  format
  episodes
  averageScore
  genres
  description
  siteUrl
  status
`.trim();

const SELF_QUERY = 'query ($id: Int) { Media(id: $id) {';

const SEARCH_QUERY_HEAD = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: ANIME) {
`.trim();

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

	private requestedFields: string[] = [];
	private hasToken = false;
	private accessToken = '';

	// tell the provider which fields the user wants in the graphql query
	setRequestedFields(fields: string[], hasToken: boolean): void {
		this.requestedFields = fields;
		this.hasToken = hasToken;
	}

	setAccessToken(token: string): void {
		this.accessToken = token;
	}

	private getToken(): string | undefined {
		return this.accessToken || undefined;
	}

	// build a list of graphql fragments for all requested non-personal fields
	// personal fields are excluded — they live inside mediaListEntry {}
	private getSelectedGraphQLFragments(): string[] {
		const allDefs = getFields('anime');
		const fragments: string[] = [];
		const handled = new Set<string>();

		// fields already covered by ALWAYS_DETAIL_GRAPHQL
		const alwaysFields = new Set(
			ALWAYS_DETAIL_GRAPHQL.split('\n').map((l) => l.trim().split(/\s/)[0]).filter(Boolean),
		);

		// known composite AniList types that need sub-selection but aren't in the field definitions
		const COMPOSITE_FIELDS: Record<string, string> = {
			'startDate': 'startDate { year month day }',
			'endDate': 'endDate { year month day }',
			'nextAiringEpisode': 'nextAiringEpisode { airingAt timeUntilAiring episode }',
		};

		for (const key of this.requestedFields) {
			const def = allDefs.find((f) => f.key === key);
			if (def && def.graphql && !def.personal && !handled.has(def.graphql)) {
				fragments.push(def.graphql);
				handled.add(def.graphql);
			} else if (!def) {
				// custom field name — use as-is (simple) or with sub-selection (composite)
				const simple = key.replace(/[^a-zA-Z0-9_]/g, '');
				if (!simple || handled.has(simple) || alwaysFields.has(simple)) continue;

				const composite = COMPOSITE_FIELDS[simple];
				if (composite) {
					fragments.push(composite);
					handled.add(simple);
				} else {
					fragments.push(simple);
					handled.add(simple);
				}
			}
		}

		return fragments;
	}

	// check whether the user has requested any personal (tracking) fields
	private needsMediaListEntry(): boolean {
		if (!this.hasToken) return false;
		const personalKeys = ['progress', 'score', 'myStatus', 'startedAt', 'completedAt', 'notes', 'repeat', 'progressVolumes'];
		return this.requestedFields.some((k) => personalKeys.includes(k));
	}

	// build the mediaListEntry sub-query for personal tracking data
	private buildMediaListEntryFragment(): string {
		return `mediaListEntry {
      id
      status
      score
      progress
      progressVolumes
      repeat
      notes
      startedAt { year month day }
      completedAt { year month day }
    }`;
	}

	// search anilist by title — returns minimal data for the suggestion list
	async search(query: string): Promise<SearchResult[]> {
		const q = `${SEARCH_QUERY_HEAD}${SEARCH_GRAPHQL}
    }
  }
}`;

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

	// fetch full detail for a single anime — builds a dynamic graphql query from requested fields
	async fetchDetails(sourceId: string, raw?: unknown): Promise<MediaDetails | null> {
		const id = raw
			? (raw as Record<string, unknown>)['id']
			: parseInt(sourceId, 10);

		const extraFragments = this.getSelectedGraphQLFragments();
		const mleFragment = this.needsMediaListEntry() ? `\n    ${this.buildMediaListEntryFragment()}` : '';
		const extra = extraFragments.length > 0 ? `\n    ${extraFragments.join('\n    ')}` : '';

		const q = `${SELF_QUERY}
    ${ALWAYS_DETAIL_GRAPHQL}${extra}${mleFragment}
  }
}`;

		console.debug('Babylon: requestedFields', this.requestedFields);
		console.debug('Babylon: detail query', q);

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
			studios: studioNames,
			averageScore: (media['averageScore'] as number) ?? null,
			siteUrl: (media['siteUrl'] as string) ?? null,
			format: (media['format'] as string) ?? null,
			episodes: (media['episodes'] as number) ?? null,
			sourceId: String(media['id']),
			provider: 'anilist',
		};

		// flatten remaining fields into details for template use
		const extraKeys = [
			'id', 'status', 'season', 'duration',
			'bannerImage', 'meanScore', 'popularity', 'favourites',
			'hashtag', 'countryOfOrigin', 'isAdult', 'source', 'synonyms', 'updatedAt',
			'rankings', 'trailer', 'streamingEpisodes', 'externalLinks',
		];
		for (const key of extraKeys) {
			if (media[key] !== undefined) {
				details[key] = media[key];
			}
		}

		// join tag names into a comma-separated string
		const tags = media['tags'] as Array<Record<string, unknown>> | undefined;
		if (tags) {
			details['tags'] = tags.map((t) => t['name']).filter(Boolean).join(', ');
		}

		// expose cover variants individually
		const coverImg = media['coverImage'] as Record<string, unknown> | undefined;
		if (coverImg) {
			details['coverExtraLarge'] = coverImg['extraLarge'] ?? null;
			details['coverMedium'] = coverImg['medium'] ?? null;
			details['coverColor'] = coverImg['color'] ?? null;
		}

		// flatten mediaListEntry into top-level details
		const mle = media['mediaListEntry'] as Record<string, unknown> | undefined;
		if (mle) {
			details['progress'] = mle['progress'] ?? null;
			details['score'] = mle['score'] ?? null;
			details['myStatus'] = mle['status'] ?? null;
			details['repeat'] = mle['repeat'] ?? null;
			details['notes'] = mle['notes'] ?? null;
			details['progressVolumes'] = mle['progressVolumes'] ?? null;

			const sa = mle['startedAt'] as Record<string, unknown> | undefined;
			if (sa) details['startedAt'] = sa;
			const ca = mle['completedAt'] as Record<string, unknown> | undefined;
			if (ca) details['completedAt'] = ca;
		}

		// extra requested custom fields from media directly
		for (const key of this.requestedFields) {
			const simpleName = key.replace(/[^a-zA-Z0-9_]/g, '');
			if (simpleName && details[simpleName] === undefined && media[simpleName] !== undefined) {
				details[simpleName] = media[simpleName];
			}
		}

		return details;
	}
}
