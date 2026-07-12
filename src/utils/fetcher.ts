import { requestUrl, type RequestUrlParam } from 'obsidian';

export type JsonFetcher = (
	url: string,
	headers?: Record<string, string>,
	method?: 'GET' | 'POST',
	body?: string,
) => Promise<unknown>;

export async function fetchJson(
	url: string,
	headers?: Record<string, string>,
	method?: 'GET' | 'POST',
	body?: string,
): Promise<unknown> {
	const params: RequestUrlParam = { url, method: method ?? 'GET' };
	if (headers) params.headers = headers;
	if (body) params.body = body;
	if (method === 'POST') params.contentType = 'application/json';

	const resp = await requestUrl(params);
	if (resp.status >= 400) {
		throw new Error(`HTTP ${resp.status}: ${resp.text}`);
	}
	return resp.json;
}
