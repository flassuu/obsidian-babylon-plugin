import { requestUrl, type RequestUrlParam } from 'obsidian';

export async function fetchJson(
	url: string,
	method: 'GET' | 'POST',
	body?: string,
): Promise<unknown> {
	const params: RequestUrlParam = {
		url,
		method,
		contentType: 'application/json',
	};
	if (body) params.body = body;

	const resp = await requestUrl(params);
	if (resp.status >= 400) {
		console.error('Babylon API error:', resp.text);
		throw new Error(`HTTP ${resp.status}`);
	}
	return resp.json;
}
