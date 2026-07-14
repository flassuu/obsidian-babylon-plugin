import { requestUrl } from 'obsidian';

const ANILIST_API = 'https://graphql.anilist.co';
const ANILIST_AUTH_URL = 'https://anilist.co/api/v2/oauth/authorize';

export function getAnilistAuthUrl(clientId: string): string {
	return `${ANILIST_AUTH_URL}?client_id=${clientId}&response_type=token`;
}

export async function fetchJson(
	url: string,
	method: 'GET' | 'POST',
	body?: string,
	token?: string,
): Promise<unknown> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;

	const resp = await requestUrl({ url, method, headers, body, throw: false });
	if (resp.status >= 400) throw new Error(`HTTP ${resp.status}: ${resp.text.slice(0, 200)}`);
	return resp.json;
}

async function requestRaw(query: string, variables: Record<string, unknown>, token?: string): Promise<Record<string, unknown>> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;

	const resp = await requestUrl({
		url: ANILIST_API,
		method: 'POST',
		headers,
		body: JSON.stringify({ query, variables }),
		throw: false,
	});

	if (resp.status >= 400) {
		throw new Error(`AniList returned ${resp.status}: ${resp.text.slice(0, 200)}`);
	}

	const json = resp.json as Record<string, unknown>;
	const errors = json['errors'] as Array<Record<string, unknown>> | undefined;
	if (errors && errors.length) {
		throw new Error(errors[0]?.['message'] as string ?? 'AniList API error');
	}

	return json;
}

export async function requestAnilist(query: string, variables: Record<string, unknown>, token?: string): Promise<unknown> {
	const json = await requestRaw(query, variables, token);
	return json['data'];
}

export interface AnilistTestResult {
	success: boolean;
	username?: string;
	avatarUrl?: string;
	about?: string;
	totalAnime?: number;
	episodesWatched?: number;
	meanScore?: number;
	error?: string;
}

const STATS_QUERY = `
query {
  Viewer {
    id
    name
    avatar { large }
    about
    statistics {
      anime {
        count
        episodesWatched
        meanScore
      }
    }
  }
}`;

export async function testAnilistToken(token: string): Promise<AnilistTestResult> {
	try {
		const json = await requestRaw(STATS_QUERY, {}, token);
		const viewer = json['data'] as Record<string, unknown> | undefined;
		if (!viewer || !(viewer['Viewer'] as Record<string, unknown> | undefined)) {
			return { success: false, error: 'Invalid response from AniList' };
		}

		type ViewerData = Record<string, unknown>;
		const v = viewer['Viewer'] as ViewerData;
		const stats = v['statistics'] as ViewerData | undefined;
		const animeStats = stats?.['anime'] as ViewerData | undefined;

		return {
			success: true,
			username: v['name'] as string,
			avatarUrl: ((v['avatar'] as ViewerData)?.['large'] as string) ?? undefined,
			about: v['about'] as string ?? undefined,
			totalAnime: (animeStats?.['count'] as number) ?? undefined,
			episodesWatched: (animeStats?.['episodesWatched'] as number) ?? undefined,
			meanScore: (animeStats?.['meanScore'] as number) ?? undefined,
		};
	} catch (err) {
		return { success: false, error: err instanceof Error ? err.message : String(err) };
	}
}

export async function fetchAnilistUserId(token: string): Promise<number> {
	const json = await requestRaw('query { Viewer { id } }', {}, token);
	const data = json['data'] as Record<string, unknown> | undefined;
	const viewer = data?.['Viewer'] as Record<string, unknown> | undefined;
	const id = viewer?.['id'] as number | undefined;
	if (!id) throw new Error('Could not get AniList user ID');
	return id;
}
