import { App, FuzzySuggestModal, Modal, Notice, Setting } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';
import { getAnilistAuthUrl, testAnilistToken } from '../../utils/fetcher';
import { normalizePath } from './media';
import { FieldSelector } from '../ui/FieldSelector';
import { GenerateTemplateModal } from '../ui/GenerateTemplateModal';
import { addFolderPicker } from '../ui/FolderPicker';
import { createCollapsible, createObsidianToggle } from '../ui/CollapsibleSection';
import { SyncEngine, saveFieldMap, generateFieldMapFromTemplate, makeFieldMapPath, fetchAllListData } from '../../sync';
import { SyncReviewModal } from '../../sync/ui/SyncReviewModal';
import { FieldMapEditorModal } from '../../sync/ui/FieldMapEditorModal';
import {
	makePresetPath,
	loadPresets,
	savePresets,
	ensureSingleDefault,
	buildDefaultPreset,
	makeCopyName,
	makeFieldId,
	resolveActivePreset,
} from '../../presets';
import type { MediaPreset } from '../../presets';
import { PresetEditorModal } from '../../presets/ui/PresetEditorModal';

const CLIENT_ID = '45744';

class AuthInstructionsModal extends Modal {
	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: tr('settings-anilist-auth') });
		contentEl.createEl('p', { text: tr('settings-anilist-auth-desc') });
		const ol = contentEl.createEl('ol');
		ol.createEl('li', { text: tr('settings-anilist-step-click') });
		ol.createEl('li', { text: tr('settings-anilist-step-approve') });
		ol.createEl('li', { text: tr('settings-anilist-step-copy') });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function createTokenUI(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	new Setting(containerEl)
		.setName(tr('settings-anilist-token'))
		.addText((text) => {
			text.setPlaceholder(tr('settings-anilist-token-placeholder'));
			text.setValue(plugin.settings.anilistAuth.accessToken);
			text.inputEl.type = 'password';
			text.onChange(async (value) => {
				plugin.settings.anilistAuth.accessToken = value;
				await plugin.saveSettings();
				await plugin.updateAnilistProvider();
			});
		})
		.addButton((btn) => {
			btn.setIcon('info');
			btn.setTooltip(tr('settings-anilist-auth-instructions'));
			btn.onClick(() => {
				new AuthInstructionsModal(plugin.app).open();
			});
		});
}

function createConnectionUI(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	new Setting(containerEl)
		.setName(tr('settings-anilist-authorize'))
		.addButton((btn) => {
			btn.setButtonText(tr('settings-anilist-authorize'));
			btn.onClick(() => {
				window.open(getAnilistAuthUrl(CLIENT_ID), '_blank');
			});
		});

	const testSetting = new Setting(containerEl)
		.setName(tr('settings-test-btn'))
		.setDesc(tr('settings-test-desc'))
		.addButton((btn) => {
			btn.setButtonText(tr('settings-test-btn'));
			btn.onClick(async () => {
				const token = plugin.settings.anilistAuth.accessToken.trim();
				if (!token) {
					testSetting.setDesc(tr('settings-test-empty'));
					return;
				}
				testSetting.setDesc(tr('settings-test-running'));
				const result = await testAnilistToken(token);
				if (result.success) {
					const parts: string[] = [];
					if (result.totalAnime !== undefined) parts.push(`Total: ${result.totalAnime}`);
					if (result.episodesWatched !== undefined) parts.push(`Episodes: ${result.episodesWatched}`);
					if (result.meanScore !== undefined) parts.push(`Score: ${result.meanScore}`);
					testSetting.setDesc(`${result.username}\n${parts.join('  |  ')}`);
				} else {
					testSetting.setDesc('\u2717 ' + (result.error ?? 'Unknown error'));
				}
			});
		});
}

function createSyncSettings(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	new Setting(containerEl)
		.setName(tr('settings-sync-on-startup'))
		.setDesc(tr('settings-sync-on-startup-desc'))
		.addToggle((toggle) => {
			toggle.setValue(plugin.settings.sync.syncOnStartup);
			toggle.onChange(async (value) => {
				plugin.settings.sync.syncOnStartup = value;
				await plugin.saveSettings();
			});
		});

	// Sync all button
	new Setting(containerEl)
		.setName(tr('sync-all'))
		.setDesc(tr('sync-all-desc'))
		.addButton((btn) => {
			btn.setButtonText(tr('sync-all'));
			btn.setCta();
			btn.onClick(async () => {
				const token = plugin.settings.anilistAuth.accessToken.trim();
				if (!token) {
					new Notice('AniList token required for sync');
					return;
				}
				new Notice(tr('sync-in-progress'));
				try {
					const engine = new SyncEngine(plugin);
					const remoteData = await fetchAllListData(plugin.app, token, 'ANIME');
					const result = await engine.syncAll('anime', remoteData);
					if (result.changes.length === 0) {
						new Notice(tr('sync-nothing'));
						return;
					}
					new SyncReviewModal(plugin, result.changes).open();
				} catch (err) {
					console.error('Babylon: Sync failed', err);
					new Notice(tr('sync-error'));
				}
			});
		});

	// Clear per-note ignores
	new Setting(containerEl)
		.setName(tr('sync-clear-ignores'))
		.setDesc(tr('sync-clear-ignores-desc'))
		.addButton((btn) => {
			btn.setButtonText(tr('sync-clear-ignores'));
			btn.onClick(() => {
				const ignored = plugin.settings.noteIgnoreOverrides;
				if (!ignored || Object.keys(ignored).length === 0) {
					new Notice(tr('sync-no-ignores'));
					return;
				}
				plugin.settings.noteIgnoreOverrides = {};
				void plugin.saveSettings().then(() => {
					new Notice(tr('sync-ignores-cleared'));
					plugin.settingsTab.display();
				});
			});
		});
}

function createPresetSection(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	const mediaType = 'anime';
	const presetPath = `${plugin.settings.templateFolder}/${makePresetPath(mediaType)}`;

	const listEl = containerEl.createDiv({ cls: 'babylon-preset-settings-list' });

	async function renderList(): Promise<void> {
		const collection = await loadPresets(plugin.app, presetPath);
		listEl.empty();
		if (!collection || collection.presets.length === 0) {
			listEl.createEl('p', {
				text: tr('preset-none-found'),
				cls: 'setting-item-description',
			});
			return;
		}
		for (const preset of collection.presets) {
			renderRow(listEl, preset);
		}
	}

	function renderRow(container: HTMLElement, preset: MediaPreset): void {
		const row = container.createDiv({ cls: 'babylon-preset-settings-row' });
		const info = row.createDiv({ cls: 'babylon-preset-settings-info' });
		info.createSpan({ text: preset.name, cls: 'babylon-preset-settings-name' });
		if (preset.isDefault) {
			info.createSpan({
				text: tr('preset-default-badge'),
				cls: 'babylon-preset-settings-badge',
			});
		}
		info.createSpan({
			text: tr('preset-field-count', { count: preset.fields.length }),
			cls: 'babylon-preset-settings-count',
		});

		const btns = row.createDiv({ cls: 'babylon-preset-settings-btns' });
		if (!preset.isDefault) {
			const defBtn = btns.createEl('button', { text: tr('preset-set-default') });
			defBtn.addEventListener('click', () => {
				void (async () => {
					const col = await loadPresets(plugin.app, presetPath);
					if (!col) return;
					ensureSingleDefault(col, preset.name);
					await savePresets(plugin.app, presetPath, col);
					await plugin.updateAnilistProvider();
					await renderList();
				})();
			});
		}
		const editBtn = btns.createEl('button', { text: tr('preset-edit') });
		editBtn.addEventListener('click', () => {
			new PresetEditorModal(plugin, mediaType, preset).open();
		});
		const dupBtn = btns.createEl('button', { text: tr('preset-duplicate') });
		dupBtn.addEventListener('click', () => {
			void (async () => {
				const col = await loadPresets(plugin.app, presetPath);
				if (!col) return;
				const copyName = makeCopyName(preset.name);
				if (col.presets.some((p) => p.name === copyName)) {
					new Notice(tr('preset-name-clash'));
					return;
				}
				const copy: MediaPreset = JSON.parse(JSON.stringify(preset)) as MediaPreset;
				copy.name = copyName;
				copy.isDefault = false;
				copy.fields = copy.fields.map((f) => ({ ...f, id: makeFieldId() }));
				col.presets.push(copy);
				await savePresets(plugin.app, presetPath, col);
				await renderList();
			})();
		});
	}

	new Setting(containerEl)
		.setName(tr('preset-create'))
		.setDesc(tr('preset-create-desc'))
		.addButton((btn) => {
			btn.setButtonText(tr('preset-create'));
			btn.setCta();
			btn.onClick(() => {
				void (async () => {
					const collection = await loadPresets(plugin.app, presetPath);
					const hasDefault = collection?.presets.some((p) => p.isDefault) ?? false;
					const preset = buildDefaultPreset(mediaType);
					if (hasDefault) preset.isDefault = false;
					new PresetEditorModal(plugin, mediaType, preset).open();
				})();
			});
		});

	new Setting(containerEl)
		.setName(tr('preset-regenerate'))
		.setDesc(tr('preset-regenerate-desc'))
		.addButton((btn) => {
			btn.setButtonText(tr('preset-regenerate'));
			btn.onClick(() => {
				void (async () => {
					const collection = await loadPresets(plugin.app, presetPath);
					const preset = resolveActivePreset(collection);
					if (!preset) {
						new Notice(tr('preset-none-found'));
						return;
					}
					new GenerateTemplateModal(plugin, mediaType, preset).open();
				})();
			});
		});

	// render the list on the next tick so the DOM is ready
	window.setTimeout(() => {
		void renderList();
	}, 50);
}

function createLegacyFieldMapUI(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	const mapPath = `${plugin.settings.templateFolder}/${makeFieldMapPath('anime')}`;

	new Setting(containerEl)
		.setName(tr('sync-field-map'))
		.setDesc(tr('sync-field-map-missing'))
		.addButton((btn) => {
			btn.setButtonText(tr('sync-generate-map'));
			btn.onClick(async () => {
				const animeS = plugin.settings.media.anime;
				if (!animeS?.templatePath) {
					new Notice('No template configured. Generate a template first.');
					return;
				}
				const map = await generateFieldMapFromTemplate(plugin.app, 'anime', animeS.templatePath);
				if (map) {
					await saveFieldMap(plugin.app, mapPath, map);
					new Notice(tr('sync-field-map-generated').replace('{path}', mapPath));
					plugin.settingsTab.display();
				}
			});
		})
		.addButton((btn) => {
			btn.setButtonText(tr('field-map-editor-edit'));
			btn.onClick(() => {
				new FieldMapEditorModal(plugin, 'anime').open();
			});
		});
}

function createTemplateManager(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	const animeSettings = plugin.settings.media.anime;
	if (!animeSettings) return;

	const details = containerEl.createEl('details', { cls: 'babylon-tmpl-manager' });
	details.open = true;

	const summary = details.createEl('summary', { cls: 'babylon-tmpl-summary' });
	summary.createSpan({ text: tr('settings-tmpl-manager') });

	const body = details.createDiv({ cls: 'babylon-tmpl-body' });

	// description + wiki link
	const descP = body.createEl('p', { cls: 'babylon-tmpl-desc' });
	descP.appendText(tr('settings-tmpl-desc'));
	const wikiLink = descP.createEl('a', {
		href: 'https://github.com/flassuu/obsidian-babylon-plugin/wiki',
		text: tr('settings-tmpl-wiki'),
	});
	wikiLink.addClass('babylon-tmpl-wiki');

	// FieldSelector
	const fieldContainer = body.createDiv({ cls: 'babylon-field-selector' });
	const personalOn = plugin.settings.anilistAuth.personalizationEnabled;
	new FieldSelector(plugin, 'anime', fieldContainer, personalOn, () => {
		// nothing extra
	});

	// Custom fields section
	const customFieldsSetting = new Setting(body)
		.setName(tr('settings-tmpl-custom-fields'))
		.setDesc(tr('settings-tmpl-custom-desc'));

	const customDescEl = customFieldsSetting.descEl;
	customDescEl.appendText(' ');
	const wikiA = customDescEl.createEl('a', {
		href: 'https://github.com/flassuu/obsidian-babylon-plugin/wiki',
		text: tr('settings-tmpl-wiki'),
	});
	wikiA.addClass('babylon-tmpl-wiki');

	// tags container — we keep a reference for incremental updates
	const tagContainer = body.createDiv({ cls: 'babylon-custom-tags' });
	const s0 = animeSettings;
	renderTags();

	function renderTags(): void {
		if (!s0) return;
		tagContainer.empty();
		const names = s0.customFieldNames ?? [];
		if (names.length === 0) return;
		for (const name of names) {
			const tag = tagContainer.createSpan({ cls: 'babylon-custom-tag' });
			tag.createSpan({ text: name });
			const removeBtn = tag.createSpan({ cls: 'babylon-custom-tag-remove' });
			removeBtn.textContent = '\u00D7';
			removeBtn.addEventListener('click', () => {
				void (async () => {
					s0.customFieldNames = s0.customFieldNames.filter((f) => f !== name);
					s0.selectedFields = s0.selectedFields.filter((f) => f !== name);
					await plugin.saveSettings();
					await plugin.updateAnilistProvider();
					renderTags();
				})();
			});
		}
	}

	customFieldsSetting.addText((text) => {
		text.setPlaceholder(tr('field-custom-example'));
		text.inputEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				addCustomField(text.getValue().trim());
				text.setValue('');
			}
		});
	});

	customFieldsSetting.addButton((btn) => {
		btn.setIcon('plus');
		btn.setTooltip('Add field');
		btn.onClick(() => {
			const inputEl = customFieldsSetting.settingEl.querySelector('input[type="text"]');
			if (inputEl instanceof HTMLInputElement) {
				addCustomField(inputEl.value.trim());
				inputEl.value = '';
			}
		});
	});

	function addCustomField(val: string): void {
		const s = animeSettings;
		if (!s) return;
		if (!val || s.customFieldNames.includes(val)) return;
		s.customFieldNames.push(val);
		void plugin.saveSettings();
		void plugin.updateAnilistProvider();
		renderTags();
	}

	// Generate template button
	new Setting(body)
		.setName(tr('settings-generate-template'))
		.setDesc(tr('settings-generate-template-desc'))
		.addButton((btn) => {
			btn.setButtonText(tr('gen-template-generate'));
			btn.setCta();
			btn.onClick(() => {
				const modal = new GenerateTemplateModal(plugin, 'anime');
				modal.onClose = () => {
					// templatePath was already set inside modal
					// update the search input value in-place if it exists
			const templateSearch = containerEl.querySelector('.babylon-template-search');
				if (templateSearch instanceof HTMLInputElement) {
					templateSearch.value = animeSettings?.templatePath ?? '';
				}
				};
				modal.open();
			});
		});
}

class FileSuggestModal extends FuzzySuggestModal<string> {
	private onSelect: (path: string) => void;

	constructor(app: App, onSelect: (path: string) => void) {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder('Search template files...');
	}

	getItems(): string[] {
		return this.app.vault.getMarkdownFiles().map((f) => f.path);
	}

	getItemText(item: string): string {
		return item;
	}

	onChooseItem(item: string): void {
		this.onSelect(item);
	}
}

export function createAnimeSection(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	const animeSettings = plugin.settings.media.anime;
	const personalizationOn = plugin.settings.anilistAuth.personalizationEnabled;
	const app = plugin.app;

	// Provider
	new Setting(containerEl)
		.setName(tr('settings-provider'))
		.addDropdown((dropdown) => {
			dropdown.addOption('anilist', 'AniList');
			dropdown.setValue(animeSettings?.provider ?? 'anilist');
			dropdown.onChange(async (value) => {
				if (animeSettings) {
					animeSettings.provider = value as 'anilist';
					await plugin.saveSettings();
				}
			});
		});

	// Personalization — collapsible group whose header carries the enable toggle;
	// open state follows the toggle (no manual folding)
	const personalization = createCollapsible(containerEl, {
		title: tr('settings-anilist-personalization'),
		desc: tr('settings-anilist-personalization-desc'),
		defaultOpen: personalizationOn,
		key: 'anime-personalization',
		level: 3,
		toggleable: false,
		headerControl: (controls) => {
			createObsidianToggle(controls, personalizationOn, (value) => {
				plugin.settings.anilistAuth.personalizationEnabled = value;
				void plugin.saveSettings();
				renderPersonalizationBody();
				personalization.setOpen(value);
			}, tr('settings-anilist-personalization'));
		},
	});

	function renderPersonalizationBody(): void {
		personalization.body.empty();
		if (!plugin.settings.anilistAuth.personalizationEnabled) return;

		createTokenUI(personalization.body, plugin);
		createConnectionUI(personalization.body, plugin);

		// Enable sync — collapsible group whose header carries the enable toggle;
		// sub-parameters expand when sync is on and close when it is off
		const sync = createCollapsible(personalization.body, {
			title: tr('settings-sync-enabled'),
			desc: tr('settings-sync-enabled-desc'),
			defaultOpen: plugin.settings.sync.enabled,
			key: 'anime-sync',
			level: 4,
			toggleable: false,
			headerControl: (controls) => {
				createObsidianToggle(controls, plugin.settings.sync.enabled, (value) => {
					plugin.settings.sync.enabled = value;
					void plugin.saveSettings();
					renderSyncBody();
					sync.setOpen(value);
				}, tr('settings-sync-enabled'));
			},
		});

		function renderSyncBody(): void {
			sync.body.empty();
			if (!plugin.settings.sync.enabled) return;
			createSyncSettings(sync.body, plugin);
		}
		renderSyncBody();
	}
	renderPersonalizationBody();

	// Presets — the visual note builder
	const presets = createCollapsible(containerEl, {
		title: tr('preset-section'),
		desc: tr('preset-section-desc'),
		defaultOpen: true,
		key: 'anime-presets',
		level: 3,
	});
	createPresetSection(presets.body, plugin);

	// Output folder
	if (animeSettings) {
		const folderSetting = new Setting(containerEl)
			.setName(tr('settings-folder'))
			.setDesc(tr('settings-folder-desc'));

		addFolderPicker(
			folderSetting,
			plugin.app,
			animeSettings.folder,
			(value) => {
				animeSettings.folder = value;
				void plugin.saveSettings();
			},
		);
	}

	// Template file (auto-updated by Generate, manual override via file picker)
	if (animeSettings) {
		const templateSetting = new Setting(containerEl)
			.setName(tr('settings-template'))
			.setDesc(tr('settings-template-desc'));

		templateSetting.addSearch((search) => {
			search.setValue(animeSettings.templatePath);
			search.onChange((value) => {
				animeSettings.templatePath = normalizePath(app, value);
				void plugin.saveSettings();
			});
			search.inputEl.addClass('babylon-folder-input');
			search.inputEl.addClass('babylon-template-search');
		});

		templateSetting.addButton((btn) => {
			btn.setIcon('folder-open');
			btn.setTooltip('Browse files');
			btn.onClick(() => {
				const modal = new FileSuggestModal(app, (path) => {
					animeSettings.templatePath = path;
					void plugin.saveSettings();
					// update the search input in-place
					const searchInput = templateSetting.settingEl.querySelector('.babylon-template-search');
					if (searchInput instanceof HTMLInputElement) {
						searchInput.value = path;
					}
				});
				modal.open();
			});
		});

		templateSetting.addButton((btn) => {
			btn.setIcon('x');
			btn.setTooltip('Clear');
			btn.onClick(() => {
				animeSettings.templatePath = '';
				void plugin.saveSettings();
				// update the search input in-place instead of full re-render
				const searchInput = templateSetting.settingEl.querySelector('.babylon-template-search');
				if (searchInput instanceof HTMLInputElement) {
					searchInput.value = '';
				}
			});
		});
	}

	// the template file only provides the note body when a preset exists
	containerEl.createEl('p', {
		text: tr('preset-body-hint'),
		cls: 'setting-item-description',
	});

	// Legacy: template manager + field map (deprecated, hidden by default)
	const legacy = createCollapsible(containerEl, {
		title: tr('preset-legacy'),
		desc: tr('preset-legacy-desc'),
		defaultOpen: false,
		key: 'anime-legacy',
		level: 3,
	});
	createLegacyFieldMapUI(legacy.body, plugin);
	createTemplateManager(legacy.body, plugin);
}