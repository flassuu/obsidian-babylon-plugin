import { App, FuzzySuggestModal, Modal, Notice, Setting } from 'obsidian';
import type BabylonPlugin from '../../main';
import type { MediaTypeSettings } from '../../types';
import { tr } from '../../i18n';
import { getAnilistAuthUrl, testAnilistToken } from '../../utils/fetcher';
import { normalizePath } from './media';
import { FieldSelector } from '../ui/FieldSelector';
import { GenerateTemplateModal } from '../ui/GenerateTemplateModal';
import { addFolderPicker } from '../ui/FolderPicker';
import { SyncEngine, loadFieldMap, saveFieldMap, generateFieldMapFromTemplate, makeFieldMapPath, getDefaultFieldMap, fetchAllListData } from '../../sync';
import { SyncReviewModal } from '../../sync/ui/SyncReviewModal';
import { FieldMapEditorModal } from '../../sync/ui/FieldMapEditorModal';

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

function createAuthUI(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	new Setting(containerEl)
		.setName(tr('settings-anilist-token'))
		.addText((text) => {
			text.setPlaceholder(tr('settings-anilist-token-placeholder'));
			text.setValue(plugin.settings.anilistAuth.accessToken);
			text.inputEl.type = 'password';
			text.onChange(async (value) => {
				plugin.settings.anilistAuth.accessToken = value;
				await plugin.saveSettings();
				plugin.updateAnilistProvider();
			});
		})
		.addButton((btn) => {
			btn.setIcon('info');
			btn.setTooltip(tr('settings-anilist-auth-instructions'));
			btn.onClick(() => {
				new AuthInstructionsModal(plugin.app).open();
			});
		})
		.addButton((btn) => {
			btn.setButtonText(tr('settings-anilist-authorize'));
			btn.onClick(() => {
				window.open(getAnilistAuthUrl(CLIENT_ID), '_blank');
			});
		});

	const testSetting = new Setting(containerEl)
		.setName(tr('settings-test'))
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

function createSyncUI(containerEl: HTMLElement, plugin: BabylonPlugin, _animeSettings: MediaTypeSettings | undefined): void {
	new Setting(containerEl)
		.setName(tr('settings-sync-enabled'))
		.setDesc(tr('settings-sync-enabled-desc'))
		.addToggle((toggle) => {
			toggle.setValue(plugin.settings.sync.enabled);
			toggle.onChange(async (value) => {
				plugin.settings.sync.enabled = value;
				await plugin.saveSettings();
				plugin.settingsTab.display();
			});
		});

	if (!plugin.settings.sync.enabled) return;

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

	const mapPath = `${plugin.settings.templateFolder}/${makeFieldMapPath('anime')}`;

	// Load field map status on next tick to avoid blocking render
	window.setTimeout(() => {
		loadFieldMap(plugin.app, mapPath).then((existingMap) => {
			const count = existingMap?.syncFields?.filter((f) => f.sync).length ?? 0;
			const descEls = containerEl.querySelectorAll('.setting-item-desc');
			descEls.forEach((el) => {
				if (el.textContent?.includes('field') || el.textContent?.includes('Field')) {
					const statusText = count > 0
						? tr('sync-field-map-exists').replace('{count}', String(count))
						: tr('sync-field-map-missing');
					el.textContent = statusText;
				}
			});
		}).catch(() => {});
	}, 100);

	// Field map generate + edit buttons
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
					const existingMap = await loadFieldMap(plugin.app, mapPath);
					const fieldMap = existingMap ?? getDefaultFieldMap('anime');
					new SyncReviewModal(plugin, result.changes, fieldMap).open();
				} catch (err) {
					console.error('Babylon: Sync failed', err);
					new Notice(tr('sync-error'));
				}
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
					plugin.updateAnilistProvider();
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
		plugin.updateAnilistProvider();
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

	new Setting(containerEl)
		.setName(tr('settings-anilist-personalization'))
		.setDesc(tr('settings-anilist-personalization-desc'))
		.addToggle((toggle) => {
			toggle.setValue(personalizationOn);
			toggle.onChange(async (value) => {
				plugin.settings.anilistAuth.personalizationEnabled = value;
				await plugin.saveSettings();
				plugin.settingsTab.display();
			});
		});

	if (personalizationOn) {
		createAuthUI(containerEl, plugin);
		createSyncUI(containerEl, plugin, animeSettings);
	}

	// Template manager
	createTemplateManager(containerEl, plugin);

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

}