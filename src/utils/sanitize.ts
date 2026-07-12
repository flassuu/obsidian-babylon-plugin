export function sanitizeFilename(name: string): string {
	return name
		.replace(/[\\/:*?"<>|]/g, '')
		.replace(/\s+/g, ' ')
		.replace(/\n/g, ' ')
		.trim()
		.substring(0, 200);
}

export function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, '').trim();
}
