import { App, Notice, SuggestModal } from 'obsidian';
import type { ContentProvider, MediaType, SearchResult } from '../../types';
import { tr } from '../../i18n';

// search-and-select modal backed by a ContentProvider
export class AddContentModal extends SuggestModal<SearchResult> {
	private provider: ContentProvider;
	private mediaType: MediaType;
	onSubmit: ((result: SearchResult) => void) | null = null;
	private lastQuery = '';
	private debounceTimer: number | null = null;

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

	// fetch suggestions with 300ms debounce to avoid rate-limiting the api
	async getSuggestions(query: string): Promise<SearchResult[]> {
		if (query.length < 2) return [];
		this.lastQuery = query;

		return new Promise((resolve) => {
			if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
			this.debounceTimer = window.setTimeout(() => {
				void (async () => {
					try {
						resolve(await this.provider.search(query));
					} catch (err) {
						console.error('Babylon: Search failed', err);
						new Notice(tr('search-error'));
						resolve([]);
					}
				})();
			}, 300);
		});
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
