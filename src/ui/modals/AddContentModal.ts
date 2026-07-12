import { App, Notice, SuggestModal } from 'obsidian';
import type { ContentProvider, MediaType, SearchResult } from '../../types';
import { tr } from '../../i18n';

export class AddContentModal extends SuggestModal<SearchResult> {
	private provider: ContentProvider;
	private mediaType: MediaType;
	onSubmit: ((result: SearchResult) => void) | null = null;
	private lastQuery = '';

	constructor(
		app: App,
		provider: ContentProvider,
		mediaType: MediaType,
	) {
		super(app);
		this.provider = provider;
		this.mediaType = mediaType;
		this.setPlaceholder(tr('search-placeholder'));
		this.setInstructions([
			{ command: '\u2191\u2193', purpose: 'navigate' },
			{ command: '\u21b5', purpose: 'select' },
			{ command: 'esc', purpose: 'dismiss' },
		]);
	}

	async getSuggestions(query: string): Promise<SearchResult[]> {
		if (query.length < 2) return [];
		this.lastQuery = query;

		try {
			return await this.provider.search(query);
		} catch (err) {
			console.error('Babylon: Search failed', err);
			new Notice(tr('search-error'));
			return [];
		}
	}

	renderSuggestion(result: SearchResult, el: HTMLElement): void {
		const wrapper = el.createDiv({ cls: 'babylon-search-result' });
		wrapper.createEl('strong', { text: result.title });

		const meta: string[] = [];
		if (result.year) meta.push(String(result.year));
		if (result.subtitle) meta.push(result.subtitle);
		if (meta.length) {
			wrapper.createSpan({
				cls: 'babylon-search-meta',
				text: ` \u2014 ${meta.join(', ')}`,
			});
		}
	}

	onChooseSuggestion(result: SearchResult): void {
		this.onSubmit?.(result);
	}
}
