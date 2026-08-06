import { Modal, Notice, Plugin } from 'obsidian';
import { BabylonSettingTab } from './settings/SettingsTab';
import { ProviderRegistry } from './providers/registry';
import { AnilistProvider } from './providers/anilist';
import { ContentService } from './services/ContentService';
import { AddContentModal } from './ui/modals/AddContentModal';
import { AddFromListModal } from './ui/modals/AddFromListModal';
import { setLocale, tr } from './i18n';
import { DEFAULT_SETTINGS, migrateSettings } from './settings/defaults';
import type { BabylonSettings, MediaType } from './types';
import { initFields } from './fields';
import { SyncEngine, extractSourceId, fetchAllListData, fetchSingleListData } from './sync';
import { SyncReviewModal } from './sync/ui/SyncReviewModal';
import { loadPresets, resolveActivePreset, makePresetPath, isAdvancedScoreKey } from './presets';

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
		initFields();

		this.contentService = new ContentService(this.app);

		this.anilistProvider = new AnilistProvider();
		await this.updateAnilistProvider();
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
			callback: () => this.runSync(),
		});

		this.addCommand({
			id: 'sync-note',
			name: tr('sync-note'),
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (checking) return true;
				void this.runSyncSingle(file);
				return true;
			},
		});

		if (this.settings.anilistAuth.personalizationEnabled) {
			this.addCommand({
				id: 'add-from-list',
				name: tr('add-from-list'),
				callback: () => this.startAddFromList(),
			});
		}

		if (this.settings.sync.enabled && this.settings.sync.syncOnStartup && this.settings.anilistAuth.accessToken) {
			void this.runSync();
		}
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<BabylonSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
		if (data) {
			migrateSettings(this.settings, data);
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async updateAnilistProvider(): Promise<void> {
		this.anilistProvider.setAccessToken(this.settings.anilistAuth.accessToken);
		const keys = await this.getRequestedFieldKeys('anime');
		this.anilistProvider.setRequestedFields(keys, !!this.settings.anilistAuth.accessToken);
	}

	// the fields requested in GraphQL come from the active preset's apiKeys;
	// falls back to the legacy selected/custom fields when no preset exists.
	private async getRequestedFieldKeys(type: MediaType): Promise<string[]> {
		const path = `${this.settings.templateFolder}/${makePresetPath(type)}`;
		const collection = await loadPresets(this.app, path);
		const preset = resolveActivePreset(collection);
		if (preset) {
			const keys = new Set<string>();
			for (const f of preset.fields) {
				const key = isAdvancedScoreKey(f.apiKey)
					? 'advancedScores'
					: f.apiKey.replace(/[^a-zA-Z0-9_]/g, '');
				if (key) keys.add(key);
			}
			return [...keys];
		}
		const mediaSettings = this.settings.media[type];
		return [...new Set([
			...(mediaSettings?.selectedFields ?? []),
			...(mediaSettings?.customFieldNames ?? []),
		])];
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

		const modal = new AddFromListModal(
			this.app,
			this.settings.anilistAuth.accessToken,
			(details) => {
				void (async () => {
					try {
						await this.contentService.createNote('anime', details, this.settings);
					} catch (err) {
						console.error('Babylon: Error creating note from list', err);
						new Notice(tr('create-note-error'));
					}
				})();
			},
			(sourceId) => this.anilistProvider.fetchDetails(sourceId),
		);
		modal.open();
	}

	private async runSync(): Promise<void> {
		if (!this.settings.sync.enabled) {
			new Notice('Sync is disabled. Enable it in settings first.');
			return;
		}
		if (!this.settings.anilistAuth.accessToken) {
			new Notice('AniList token not configured in settings.');
			return;
		}

		new Notice(tr('sync-in-progress'));
		try {
			const engine = new SyncEngine(this);
			const remoteData = await fetchAllListData(this.app, this.settings.anilistAuth.accessToken, 'ANIME');
			const result = await engine.syncAll('anime', remoteData);
			if (result.changes.length === 0) {
				new Notice(tr('sync-nothing'));
				return;
			}
			new SyncReviewModal(this, result.changes).open();
		} catch (err) {
			console.error('Babylon: Sync failed', err);
			new Notice(tr('sync-error'));
		}
	}

	private async runSyncSingle(file: import('obsidian').TFile): Promise<void> {
		if (!this.settings.sync.enabled) {
			new Notice('Sync is disabled.');
			return;
		}
		const sourceId = extractSourceId(file.name);
		if (!sourceId) {
			new Notice('Cannot determine source ID from filename.');
			return;
		}

		const engine = new SyncEngine(this);
		const remoteData = await fetchSingleListData(this.app, this.settings.anilistAuth.accessToken, sourceId);
		if (remoteData.size === 0) {
			new Notice('No AniList entry found for this note.');
			return;
		}
		const result = await engine.syncAll('anime', remoteData);
		if (result.changes.length === 0) {
			new Notice(tr('sync-nothing'));
			return;
		}
		new SyncReviewModal(this, result.changes).open();
	}
}
