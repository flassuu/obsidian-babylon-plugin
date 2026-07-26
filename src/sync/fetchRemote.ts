import { App } from 'obsidian';
import { requestAnilist } from '../utils/fetcher';

export type RemoteDataMap = Map<string, Record<string, string | number | null>>;

// shared gql fragment for media list entry sync fields
const ENTRY_FIELDS = `
  id
  mediaId
  status
  score
  advancedScores
  progress
  progressVolumes
  repeat
  notes
  startedAt { year month day }
  completedAt { year month day }
`;

// normalize AniList advanced score keys to camelCase, matching what the provider
// and field definitions produce for the local frontmatter.
// "Visual Direction" → "visualDirection", "Sound & Music" → "soundAndMusic"
export function normalizeAdvKey(raw: string): string {
	return raw
		.replace(/&/g, ' and ')
		.replace(/[^a-zA-Z0-9\s]/g, '')
		.split(/\s+/)
		.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join('');
}

// flatten a MediaList entry into a flat key-value map for sync comparison.
// Advanced score keys are normalized to match local frontmatter convention.
function flattenEntry(entry: Record<string, unknown>): Record<string, string | number | null> {
	const values: Record<string, string | number | null> = {
		progress: (entry['progress'] as number) ?? null,
		score: (entry['score'] as number) ?? null,
		myStatus: (entry['status'] as string) ?? null,
		repeat: (entry['repeat'] as number) ?? null,
		notes: (entry['notes'] as string) ?? null,
		progressVolumes: (entry['progressVolumes'] as number) ?? null,
	};

	const sa = entry['startedAt'] as Record<string, number> | undefined;
	if (sa?.year) values['startedAt'] = `${sa.year}-${String(sa.month).padStart(2, '0')}-${String(sa.day).padStart(2, '0')}`;

	const ca = entry['completedAt'] as Record<string, number> | undefined;
	if (ca?.year) values['completedAt'] = `${ca.year}-${String(ca.month).padStart(2, '0')}-${String(ca.day).padStart(2, '0')}`;

	// flatten advancedScores — each sub-score normalized to camelCase
	const adv = entry['advancedScores'];
	if (adv !== null && adv !== undefined && typeof adv === 'object') {
		for (const [advKey, advVal] of Object.entries(adv as Record<string, number>)) {
			const camel = normalizeAdvKey(advKey);
			values[camel] = advVal ?? null;
			values[`advancedScores.${camel}`] = advVal ?? null;
		}
	}

	return values;
}

// fetch all media list entries for the authenticated user and flatten to RemoteDataMap
export async function fetchAllListData(app: App, token: string, mediaType: 'ANIME' | 'MANGA'): Promise<RemoteDataMap> {
	const gql = `query ($type: MediaType) { MediaListCollection(type: $type) { lists { entries { ${ENTRY_FIELDS} } } } }`;
	const data = await requestAnilist(gql, { type: mediaType }, token) as Record<string, unknown>;
	const collection = data?.['MediaListCollection'] as Record<string, unknown> ?? {};
	const lists = (collection['lists'] as Array<Record<string, unknown>>) ?? [];

	const result: RemoteDataMap = new Map();
	for (const list of lists) {
		const entries = (list['entries'] as Array<Record<string, unknown>>) ?? [];
		for (const entry of entries) {
			const sourceId = String(entry['mediaId']);
			result.set(sourceId, flattenEntry(entry));
		}
	}
	return result;
}

// fetch a single media list entry and flatten to RemoteDataMap
export async function fetchSingleListData(app: App, token: string, sourceId: string): Promise<RemoteDataMap> {
	const gql = `
		query ($id: Int) {
			Media(id: $id) {
				mediaListEntry {
					${ENTRY_FIELDS}
				}
			}
		}
	`;
	const data = await requestAnilist(gql, { id: Number(sourceId) }, token) as Record<string, unknown>;
	const media = data?.['Media'] as Record<string, unknown> ?? {};
	const mle = media['mediaListEntry'] as Record<string, unknown> | undefined;
	if (!mle) return new Map();

	const result: RemoteDataMap = new Map();
	result.set(sourceId, flattenEntry(mle));
	return result;
}
