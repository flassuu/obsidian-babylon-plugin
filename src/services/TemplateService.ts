import { type App } from 'obsidian';
import type { MediaDetails } from '../types';

function flattenValue(val: unknown): string {
	if (val === null || val === undefined) return '';
	if (Array.isArray(val)) return val.map(String).join(', ');
	if (typeof val === 'object') {
		const obj = val as Record<string, unknown>;
		if ('year' in obj || 'month' in obj || 'day' in obj) {
			const y = typeof obj['year'] === 'number' ? String(obj['year']) : '';
			const m = typeof obj['month'] === 'number' ? String(obj['month']) : '';
			const d = typeof obj['day'] === 'number' ? String(obj['day']) : '';
			return [y, m, d].filter(Boolean).join('-');
		}
		return JSON.stringify(val);
	}
	if (typeof val === 'string') return val;
	if (typeof val === 'number' || typeof val === 'boolean') return String(val);
	return '';
}

function buildValueMap(details: MediaDetails): Record<string, string> {
	const map: Record<string, string> = {};
	for (const [key, val] of Object.entries(details)) {
		if (key === 'genres' && Array.isArray(val)) {
			map['genres'] = val.join(', ');
			map['genre_list'] = val.map((g: string) => `  - "${g}"`).join('\n');
			continue;
		}
		if (key === 'studios' && Array.isArray(val)) {
			map['studios'] = val.join(', ');
			map['studio_list'] = val.map((s: string) => `  - "${s}"`).join('\n');
			continue;
		}
		map[key] = flattenValue(val);
	}
	return map;
}

export class TemplateService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async render(
		templatePath: string,
		details: MediaDetails,
	): Promise<string> {
		let template = '';

		if (templatePath) {
			const vault = this.app.vault;
			try {
				template = await vault.adapter.read(templatePath);
			} catch {
				const basePath = (vault.adapter as { basePath?: string }).basePath;
				if (basePath && templatePath.startsWith(basePath)) {
					const relative = templatePath.slice(basePath.length).replace(/^[/\\]+/, '');
					try {
						template = await vault.adapter.read(relative);
					} catch {
						template = '';
					}
				}
			}
		}

		if (!template) {
			template = this.getDefaultAnimeTemplate();
		}

		const values = buildValueMap(details);
		return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
			return values[key] ?? `{{${key}}}`;
		});
	}

	getDefaultAnimeTemplate(): string {
		return [
			'---',
			'title: "{{title}}"',
			'year: {{year}}',
			'format: "{{format}}"',
			'status: "{{status}}"',
			'episodes: {{episodes}}',
			'averageScore: {{averageScore}}',
			'genres:',
			'{{genre_list}}',
			'cover: "{{cover}}"',
			'source_id: "{{sourceId}}"',
			'provider: "{{provider}}"',
			'my_progress: {{progress}}',
			'my_score: {{score}}',
			'my_status: "{{myStatus}}"',
			'---',
			'',
			'# {{title}}',
			'',
			'> {{description}}',
			'',
			'**Year:** {{year}} | **Format:** {{format}} | **Episodes:** {{episodes}}',
			'**Score:** {{averageScore}}',
			'',
			'[View on AniList]({{siteUrl}})',
		].join('\n');
	}
}
