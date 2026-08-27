import { DropdownComponent, Notice, Setting, setIcon } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';
import { getAnilistAuthUrl, testAnilistToken } from '../../utils/fetcher';
import { normalizePath } from './media';
import { FieldSelector } from '../ui/FieldSelector';
import { GenerateTemplateModal } from '../ui/GenerateTemplateModal';
import { addFolderPickerToControl, addFilePicker } from '../ui/FolderPicker';
import { createCollapsible, createObsidianToggle } from '../ui/CollapsibleSection';
import { SyncEngine, saveFieldMap, generateFieldMapFromTemplate, makeFieldMapPath, fetchAllListData } from '../../sync';
import { SyncReviewModal } from '../../sync/ui/SyncReviewModal';
import { FieldMapEditorModal } from '../../sync/ui/FieldMapEditorModal';
import { PresetManagerModal } from '../../presets/ui/PresetManagerModal';

const CLIENT_ID = '45744';

// the guide text shown in the token hint bubble, same as the old
// step-by-step instructions window used to show
function getTokenGuideText(): string {
	return [
		`1. ${tr('settings-anilist-step-click')}`,
		`2. ${tr('settings-anilist-step-approve')}`,
		`3. ${tr('settings-anilist-step-copy')}`,
	].join('\n');
}

function createTokenUI(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	const tokenSetting = new Setting(containerEl)
		.setName(tr('settings-anilist-token'))
		.setDesc(tr('settings-anilist-token-desc'));

	// the help icon is a small symbol right after the title, not a separate
	// button: hovering highlights it and an overlay bubble with the full
	// step-by-step guide appears right under it
	const tip = tokenSetting.nameEl.createSpan({
		cls: 'babylon-tip-icon',
		attr: { 'data-tip': getTokenGuideText() },
	});
	setIcon(tip, 'info');

	tokenSetting.addText((text) => {
		text.setPlaceholder(tr('settings-anilist-token-placeholder'));
		text.setValue(plugin.settings.anilistAuth.accessToken);
		text.inputEl.type = 'password';
		text.onChange(async (value) => {
			plugin.settings.anilistAuth.accessToken = value;
			await plugin.saveSettings();
			await plugin.updateAnilistProvider();
		});
	});

	// authorize action sits on the right of the token row
	tokenSetting.addButton((btn) => {
		btn.setButtonText(tr('settings-anilist-authorize'));
		btn.onClick(() => {
			window.open(getAnilistAuthUrl(CLIENT_ID), '_blank');
		});
	});
}

function createConnectionUI(containerEl: HTMLElement, plugin: BabylonPlugin): void {
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
					parts.push(`${tr('settings-test-username')}: ${result.username ?? '?'}`);
					if (result.totalAnime !== undefined) parts.push(`${tr('settings-test-total')}: ${result.totalAnime}`);
					if (result.episodesWatched !== undefined) parts.push(`${tr('settings-test-episodes')}: ${result.episodesWatched}`);
					if (result.meanScore !== undefined) parts.push(`${tr('settings-test-score')}: ${result.meanScore}`);
					testSetting.setDesc(parts.join(' | '));
				} else {
					testSetting.setDesc('\u2717 ' + (result.error ?? tr('settings-test-unknown-error')));
				}
			});
		});
}

function createSyncSettings(containerEl: HTMLElement, plugin: BabylonPlugin): void {
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
					new Notice(tr('notice-anilist-token-required'));
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
}

// Clear per-note ignores - deprecated alongside the legacy template mode
function createClearIgnoresUI(containerEl: HTMLElement, plugin: BabylonPlugin): void {
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

	new Setting(containerEl)
		.setName(tr('preset-manager-title'))
		.setDesc(tr('preset-manager-desc'))
		.addButton((btn) => {
			btn.setButtonText(tr('preset-manager-title'));
			btn.setCta();
			btn.onClick(() => {
				new PresetManagerModal(plugin, mediaType).open();
			});
		});
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

	// tags container - we keep a reference for incremental updates
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
				modal.open();
			});
		});
}

export function createAnimeSection(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	const animeSettings = plugin.settings.media.anime;
	const personalizationOn = plugin.settings.anilistAuth.personalizationEnabled;
	const app = plugin.app;

	// Provider - the dropdown lives in the group header
	createCollapsible(containerEl, {
		title: tr('settings-provider'),
		desc: tr('settings-provider-desc'),
		key: 'anime-provider',
		level: 3,
		toggleable: false,
		headerControl: (controls) => {
			const dropdown = new DropdownComponent(controls);
			dropdown.addOption('anilist', tr('provider-anilist'));
			dropdown.setValue(animeSettings?.provider ?? 'anilist');
			dropdown.onChange(async (value) => {
				if (animeSettings) {
					animeSettings.provider = value as 'anilist';
					await plugin.saveSettings();
				}
			});
		},
	});

	// Personalization - collapsible group whose header carries the enable toggle;
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
	}
	renderPersonalizationBody();

	// Enable sync - collapsible group whose header carries the enable toggle;
	// sub-parameters expand when sync is on and close when it is off
	const sync = createCollapsible(containerEl, {
		title: tr('settings-sync-enabled'),
		desc: tr('settings-sync-enabled-desc'),
		defaultOpen: plugin.settings.sync.enabled,
		key: 'anime-sync',
		level: 3,
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

	// Presets - the visual note builder
	const presets = createCollapsible(containerEl, {
		title: tr('preset-section'),
		desc: tr('preset-section-desc'),
		defaultOpen: true,
		key: 'anime-presets',
		level: 3,
	});
	createPresetSection(presets.body, plugin);

	// Output folder - the folder picker lives in the group header, the body
	// carries the template file override
	const output = createCollapsible(containerEl, {
		title: tr('settings-folder'),
		key: 'anime-output',
		level: 3,
		headerControl: (controls) => {
			addFolderPickerToControl(controls, plugin.app, animeSettings?.folder ?? '', (value) => {
				if (animeSettings) {
					animeSettings.folder = value;
					void plugin.saveSettings();
				}
			});
		},
	});

	// Template file (auto-updated by Generate, manual override via file picker)
	if (animeSettings) {
		const templateSetting = new Setting(output.body)
			.setName(tr('settings-template'))
			.setDesc(tr('settings-template-desc'));

		addFilePicker(templateSetting, app, animeSettings.templatePath, (value) => {
			animeSettings.templatePath = normalizePath(app, value);
			void plugin.saveSettings();
		});
	}

	// Legacy: template manager + field map + deprecated sync cleanup
	const legacy = createCollapsible(containerEl, {
		title: tr('preset-legacy'),
		desc: tr('preset-legacy-desc'),
		defaultOpen: false,
		key: 'anime-legacy',
		level: 3,
	});
	createLegacyFieldMapUI(legacy.body, plugin);
	createTemplateManager(legacy.body, plugin);
	createClearIgnoresUI(legacy.body, plugin);
}