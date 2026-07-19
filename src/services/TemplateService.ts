import { type App, TFile } from 'obsidian';
import type { MediaDetails } from '../types';

// convert a value to a flat string for template substitution
function flattenValue(val: unknown): string {
	if (val === null || val === undefined) return '';
	if (Array.isArray(val)) {
		if (val.length === 0) return '';
		return val.map((v) => {
			if (typeof v === 'object' && v !== null) return JSON.stringify(v);
			return String(v);
		}).join(', ');
	}
	if (typeof val === 'object') {
		const obj = val as Record<string, unknown>;
		if ('year' in obj && ('month' in obj || 'day' in obj)) {
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

// build a flat key-value map from MediaDetails for template replacement
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
		if (key === 'advancedScores' && typeof val === 'object' && val !== null) {
			const adv = val as Record<string, unknown>;
			const lines = Object.entries(adv).map(([k, v]) => {
				const camel = k
					.replace(/&/g, ' and ')
					.replace(/[^a-zA-Z0-9\s]/g, '')
					.split(/\s+/)
					.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
					.join('');
				return `${camel}: ${v}`;
			});
			map['advancedScore_List'] = lines.join('\n');
			continue;
		}
		map[key] = flattenValue(val);
	}
	return map;
}

// loads a template file and replaces {{placeholders}} with media data
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

		// try loading the user's template file; fall back to the default if it fails
		if (templatePath) {
			const file = this.app.vault.getAbstractFileByPath(templatePath);
			if (file instanceof TFile) {
				try {
					template = await this.app.vault.read(file);
				} catch {
					template = '';
				}
			}
		}

		if (!template) {
			template = this.getDefaultAnimeTemplate();
		}

		const values = buildValueMap(details);
		return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
			return values[key] ?? '';
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
