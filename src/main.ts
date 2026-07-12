import { Modal, Notice, Plugin } from 'obsidian';
import { BabylonSettingTab } from './settings/SettingsTab';
import { ProviderRegistry } from './providers/registry';
import { AnilistProvider } from './providers/anilist';
import { ContentService } from './services/ContentService';
import { AnilistSyncService } from './services/AnilistSyncService';
import { AddContentModal } from './ui/modals/AddContentModal';
import { AddFromListModal } from './ui/modals/AddFromListModal';
import { setLocale, tr } from './i18n';
import { DEFAULT_SETTINGS } from './settings/defaults';
import type { BabylonSettings, MediaType } from './types';

class TypePickerModal extends Modal {
	constructor(
		app: import('obsidian').App,
		private plugin: BabylonPlugin,
		private types: MediaType[],
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: tr('choose-type') });
		for (const type of this.types) {
			const btn = contentEl.createEl('button', {
				text: tr(type),
				cls: 'mod-cta babylon-type-btn',
			});
			btn.addEventListener('click', () => {
				this.close();
				void this.plugin.startSearch(type);
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class SourcePickerModal extends Modal {
	constructor(
		app: import('obsidian').App,
		private plugin: BabylonPlugin,
		private type: MediaType,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: tr('choose-source') });

		const searchBtn = contentEl.createEl('button', {
			text: tr('search-anilist'),
			cls: 'mod-cta babylon-source-btn',
		});
		searchBtn.addEventListener('click', () => {
			this.close();
			void this.plugin.startSearch(this.type);
		});

		const listBtn = contentEl.createEl('button', {
			text: tr('from-my-list'),
			cls: 'mod-cta babylon-source-btn',
		});
		listBtn.addEventListener('click', () => {
			this.close();
			void this.plugin.startAddFromList();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export default class BabylonPlugin extends Plugin {
	settings!: BabylonSettings;
	settingsTab!: BabylonSettingTab;
	registry = new ProviderRegistry();
	contentService!: ContentService;
	anilistProvider!: AnilistProvider;

	async onload() {
		await this.loadSettings();
		setLocale(this.settings.language);

		this.contentService = new ContentService(this.app);

		this.anilistProvider = new AnilistProvider();
		this.updateAnilistProvider();
		this.registry.register(this.anilistProvider);

		this.settingsTab = new BabylonSettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);

		this.addRibbonIcon('library', 'Babylon: Add content', () => {
			this.pickTypeAndAdd();
		});

		this.addCommand({
			id: 'add-content',
			name: tr('add-content'),
			callback: () => this.pickTypeAndAdd(),
		});

		this.addCommand({
			id: 'sync-anilist',
			name: tr('sync-anilist'),
			callback: () => this.runAnilistSync(),
		});

		if (this.settings.anilistAuth.personalizationEnabled) {
			this.addCommand({
				id: 'add-from-list',
				name: tr('add-from-list'),
				callback: () => this.startAddFromList(),
			});
		}

		if (this.settings.anilistSync.syncOnStartup && this.settings.anilistAuth.accessToken) {
			void this.runAnilistSync();
		}
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<BabylonSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	updateAnilistProvider(): void {
		this.anilistProvider.setAccessToken(this.settings.anilistAuth.accessToken);
		const combined = [
			this.settings.anilistAuth.customFieldsPublic,
			this.settings.anilistAuth.customFieldsPrivate,
			this.settings.anilistAuth.customFields,
		].filter(Boolean).join('\n');
		this.anilistProvider.setCustomFields(combined);
	}

	private pickTypeAndAdd(): void {
		const enabledTypes = (
			Object.entries(this.settings.media) as [MediaType, { enabled: boolean }][]
		)
			.filter(([, s]) => s.enabled)
			.map(([type]) => type);

		if (enabledTypes.length === 0) {
			new Notice('No media types enabled. Enable one in settings first.');
			return;
		}

		if (enabledTypes.length === 1 && enabledTypes[0]) {
			const type = enabledTypes[0];
			if (type === 'anime' && this.settings.anilistAuth.personalizationEnabled) {
				new SourcePickerModal(this.app, this, type).open();
			} else {
				void this.startSearch(type);
			}
			return;
		}

		new TypePickerModal(this.app, this, enabledTypes).open();
	}

	private async handleSearchResult(
		provider: import('./types').ContentProvider,
		type: MediaType,
		result: import('./types').SearchResult,
	): Promise<void> {
		try {
			const details = await provider.fetchDetails(result.sourceId, result.raw);
			if (!details) {
				new Notice('Failed to fetch details');
				return;
			}
			await this.contentService.createNote(type, details, this.settings);
		} catch (err) {
			console.error('Babylon: Error creating note', err);
			new Notice(tr('create-note-error'));
		}
	}

	async startSearch(type: MediaType): Promise<void> {
		const mediaSettings = this.settings.media[type];
		if (!mediaSettings?.provider) {
			new Notice(`No provider configured for ${type}. Set one in settings.`);
			return;
		}

		const provider = this.registry.get(mediaSettings.provider);
		if (!provider) {
			new Notice(`Provider "${mediaSettings.provider}" not found.`);
			return;
		}

		const modal = new AddContentModal(this.app, provider, type);
		modal.onSubmit = (result) => {
			void this.handleSearchResult(provider, type, result);
		};
		modal.open();
	}

	async startAddFromList(): Promise<void> {
		if (!this.settings.anilistAuth.accessToken) {
			new Notice('Anilist token not configured in settings.');
			return;
		}

		const modal = new AddFromListModal(this.app, this.settings.anilistAuth.accessToken, (details) => {
			void this.contentService.createNote('anime', details, this.settings);
		});
		modal.open();
	}

	private async runAnilistSync(): Promise<void> {
		if (!this.settings.anilistAuth.accessToken) {
			new Notice('Anilist token not configured in settings.');
			return;
		}

		const syncService = new AnilistSyncService(this.app, this.settings.anilistAuth.accessToken, this.settings);
		await syncService.sync();
	}
}
