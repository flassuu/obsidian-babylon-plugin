import { type App, type TFile, type Vault } from 'obsidian';
import type { MediaDetails } from '../types';

export const TEMPLATE_FIELDS: Record<string, string> = {
	title: 'Media title (English)',
	original_title: 'Original title (Romaji/Native)',
	year: 'Release year',
	description: 'Plot description (HTML stripped)',
	cover: 'Cover image URL',
	genres: 'Genres (comma separated)',
	genre_list: 'Genres (YAML list format)',
	creators: 'Creators/Studios (comma separated)',
	creator_list: 'Creators/Studios (YAML list format)',
	rating: 'Score out of 100',
	rating_10: 'Score out of 10',
	url: 'Source URL (e.g. AniList page)',
	format: 'Media format (TV, Movie, OVA, etc.)',
	episodes: 'Total episode count',
	status: 'Airing status (FINISHED, RELEASING, etc.)',
	source_id: 'Source media ID',
	source: 'Provider name (anilist, omdb, etc.)',
	popularity: 'Media popularity score',
};

function buildValueMap(details: MediaDetails): Record<string, string> {
	const genres = details.genres.join(', ');
	const genreList = details.genres.map((g) => `  - "${g}"`).join('\n');
	const creators = details.creators.join(', ');
	const creatorList = details.creators.map((c) => `  - "${c}"`).join('\n');

	return {
		title: details.title,
		original_title: details.originalTitle ?? '',
		year: details.year?.toString() ?? '',
		description: details.description ?? '',
		cover: details.cover ?? '',
		genres,
		genre_list: genreList,
		creators,
		creator_list: creatorList,
		rating: details.rating?.toString() ?? '',
		rating_10: details.rating ? (details.rating / 10).toFixed(1) : '',
		url: details.url ?? '',
		format: details.format ?? '',
		episodes: details.progressTotal?.toString() ?? '',
		status: (details['status'] as string) ?? '',
		source_id: details.sourceId,
		source: details.provider,
		popularity: (details['popularity']?.toString()) ?? '',
	};
}

export class TemplateService {
	private vault: Vault;

	constructor(app: App) {
		this.vault = app.vault;
	}

	async render(
		templateFile: TFile | null,
		details: MediaDetails,
		defaultTemplate: string,
	): Promise<string> {
		let template: string;

		if (templateFile) {
			template = await this.vault.read(templateFile);
		} else {
			template = defaultTemplate;
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
			'original_title: "{{original_title}}"',
			'year: {{year}}',
			'format: "{{format}}"',
			'episodes: {{episodes}}',
			'status: "{{status}}"',
			'rating: {{rating}}',
			'genres:',
			'{{genre_list}}',
			'studios:',
			'{{creator_list}}',
			'cover: "{{cover}}"',
			'url: "{{url}}"',
			'source_id: "{{source_id}}"',
			'provider: "{{source}}"',
			'my_rating:',
			'my_status: "not_started"',
			'my_progress: 0',
			'---',
			'',
			'![]({cover})',
			'',
			'# {{title}}',
			'',
			'> {{description}}',
			'',
			'**Year:** {{year}} | **Format:** {{format}} | **Episodes:** {{episodes}}',
			'**Genres:** {{genres}}',
			'**Studios:** {{creators}}',
			'**Rating:** ⭐ {{rating_10}}/10',
			'',
			'[View on AniList]({{url}})',
		].join('\n');
	}
}
