import type { ContentProvider, MediaDetails, MediaType, ProviderId, SearchResult } from '../types';
import { fetchJson } from '../utils/fetcher';
import { stripHtml } from '../utils/sanitize';
import { getFields } from '../fields/FieldRegistry';

const ANILIST_API = 'https://graphql.anilist.co';

// fields always needed for search results
const SEARCH_GRAPHQL = `
  id
  title { romaji english native userPreferred }
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
  title { romaji english native userPreferred }
  coverImage { extraLarge large medium color }
  seasonYear
  format
  episodes
  averageScore
  genres
  description
  siteUrl
  status
  synonyms
`.trim();

const SELF_QUERY = 'query ($id: Int) { Media(id: $id) {';

const SEARCH_QUERY_HEAD = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: ANIME) {
`.trim();

function pickTitle(title: { romaji?: string; english?: string; native?: string; userPreferred?: string }): string {
	return title.english ?? title.romaji ?? title.native ?? title.userPreferred ?? 'Unknown';
}

function pickOriginalTitle(title: { romaji?: string; english?: string; native?: string; userPreferred?: string }): string {
	return title.romaji ?? title.native ?? title.english ?? title.userPreferred ?? 'Unknown';
}

export class AnilistProvider implements ContentProvider {
	id: ProviderId = 'anilist';
	mediaTypes: MediaType[] = ['anime'];
	requiresKey = false;

	private requestedFields: string[] = [];
	private hasToken = false;
	private accessToken = '';
	private badFieldKeys = new Set<string>();

	// tell the provider which fields the user wants in the graphql query
	setRequestedFields(fields: string[], hasToken: boolean): void {
		this.requestedFields = fields;
		this.hasToken = hasToken;
		this.badFieldKeys.clear();
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

		for (const key of this.requestedFields) {
			if (this.badFieldKeys.has(key)) continue;

			const def = allDefs.find((f) => f.key === key);
			if (def && def.graphql && !def.personal && !handled.has(def.graphql)) {
				fragments.push(def.graphql);
				handled.add(def.graphql);
			} else if (!def) {
				// custom field name — use as-is (simple) or with sub-selection (composite)
				const simple = key.replace(/[^a-zA-Z0-9_]/g, '');
				if (!simple || handled.has(simple) || alwaysFields.has(simple)) continue;

				fragments.push(simple);
				handled.add(simple);
			}
		}

		return fragments;
	}

	// check whether the user has requested any personal (tracking) fields
	private needsMediaListEntry(): boolean {
		if (!this.hasToken) return false;
		const personalKeys = ['progress', 'score', 'myStatus', 'startedAt', 'completedAt', 'notes', 'repeat', 'progressVolumes', 'advancedScores'];
		return this.requestedFields.some((k) => personalKeys.includes(k));
	}

	// build the mediaListEntry sub-query for personal tracking data
	private buildMediaListEntryFragment(): string {
		const hasAdvanced = this.requestedFields.includes('advancedScores');
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
      ${hasAdvanced ? 'advancedScores' : ''}
    }`;
	}

	// if the error mentions a missing field on Media, resolve it to a requestedFields key and add to bad list
	private addBadFieldFromError(err: unknown): boolean {
		const msg = String(err);
		const match = msg.match(/Cannot query field ["\\]+(\w+)["\\]+ on type/);
		if (!match) return false;

		const fieldName = match[1];
		const allDefs = getFields('anime');

		for (const key of this.requestedFields) {
			const def = allDefs.find((f) => f.key === key);
			let gqlName: string | null = null;

			if (def && def.graphql) {
				gqlName = def.graphql.split(/[\s(]/)[0] ?? null;
			} else if (!def) {
				gqlName = key.replace(/[^a-zA-Z0-9_]/g, '');
			}

			if (gqlName && gqlName === fieldName) {
				console.warn('Babylon: removing invalid field', key, `(${fieldName})`);
				this.badFieldKeys.add(key);
				return true;
			}
		}

		// field not found in requestedFields — maybe it's in ALWAYS_DETAIL_GRAPHQL, skip silently
		return true;
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

	// fetch full detail for a single anime — retries up to 3 times, skipping bad fields
	async fetchDetails(sourceId: string, raw?: unknown): Promise<MediaDetails | null> {
		const id = raw
			? (raw as Record<string, unknown>)['id'] as number
			: parseInt(sourceId, 10);

		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				return await this.queryDetails(id);
			} catch (err) {
				const added = this.addBadFieldFromError(err);
				console.warn('Babylon: fetchDetails attempt', attempt, 'failed, added bad field:', added);
				if (!added) throw err;
			}
		}
		return null;
	}

	private async queryDetails(id: number): Promise<MediaDetails | null> {
		const extraFragments = this.getSelectedGraphQLFragments();
		const mleFragment = this.needsMediaListEntry() ? `\n    ${this.buildMediaListEntryFragment()}` : '';
		const extra = extraFragments.length > 0 ? `\n    ${extraFragments.join('\n    ')}` : '';

		const q = `${SELF_QUERY}
    ${ALWAYS_DETAIL_GRAPHQL}${extra}${mleFragment}
  }
}`;

		console.debug('Babylon: badFieldKeys', [...this.badFieldKeys]);

		const data = await fetchJson(ANILIST_API, 'POST', JSON.stringify({
			query: q,
			variables: { id },
		}), this.getToken()) as Record<string, unknown>;

		return this.buildDetails(data);
	}

	private buildDetails(data: Record<string, unknown>): MediaDetails | null {
		const media = (data['data'] as Record<string, unknown>)?.['Media'] as Record<string, unknown> ?? null;
		if (!media) return null;

		console.debug('Babylon: media keys', Object.keys(media));

		const title = media['title'] as Record<string, string>;
		const studios = media['studios'] as Record<string, unknown> ?? {};
		const studioNodes = (studios['nodes'] as Array<Record<string, string>>) ?? [];
		const studioNames = studioNodes.map((n) => n['name']).filter(Boolean) as string[];

			const details: MediaDetails = {
			title: pickTitle(title),
			originalTitle: pickOriginalTitle(title),
			title_en: title?.english ?? null,
			title_jp: title?.native ?? null,
			title_ro: title?.romaji ?? null,
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
			'id', 'idMal', 'status', 'type', 'season', 'seasonInt', 'duration',
			'startDate', 'endDate',
			'bannerImage', 'meanScore', 'popularity', 'favourites',
			'hashtag', 'countryOfOrigin', 'isAdult', 'isLicensed', 'source', 'synonyms', 'updatedAt',
			'chapters', 'volumes',
			'trending',
			'nextAiringEpisode', 'airingSchedule', 'trends',
			'rankings', 'trailer', 'streamingEpisodes', 'externalLinks',
			'reviews', 'recommendations', 'stats',
		];
		for (const key of extraKeys) {
			if (media[key] !== undefined) {
				details[key] = media[key];
			}
		}

		// extract russian title from synonyms if available
		const syns = details['synonyms'] as string[] | undefined;
		if (syns) {
			const ru = syns.find((s) => /[а-яёА-ЯЁ]/.test(s));
			if (ru) details['title_ru'] = ru;
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

			// flatten advancedScores into individual fields
			const advScores = mle['advancedScores'] as Record<string, unknown> | undefined;
			if (advScores) {
				details['advancedScores'] = advScores;
				for (const [key, val] of Object.entries(advScores)) {
					const camel = key
						.replace(/&/g, ' and ')
						.replace(/[^a-zA-Z0-9\s]/g, '')
						.split(/\s+/)
						.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
						.join('');
					details[`advancedScore_${camel}`] = val;
				}
			}
		}

		// extra requested custom fields from media directly
		for (const key of this.requestedFields) {
			if (this.badFieldKeys.has(key)) continue;
			const simpleName = key.replace(/[^a-zA-Z0-9_]/g, '');
			if (simpleName && details[simpleName] === undefined && media[simpleName] !== undefined) {
				details[simpleName] = media[simpleName];
			}
		}

		return details;
	}
}
