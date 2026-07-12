import { Modal, Setting } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';
import { getAnilistAuthUrl, testAnilistToken } from '../../utils/fetcher';
import { normalizePath } from './media';

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

function createSyncUI(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	new Setting(containerEl)
		.setName(tr('settings-sync-enabled'))
		.setDesc(tr('settings-sync-enabled-desc'))
		.addToggle((toggle) => {
			toggle.setValue(plugin.settings.anilistSync.enabled);
			toggle.onChange(async (value) => {
				plugin.settings.anilistSync.enabled = value;
				await plugin.saveSettings();
				plugin.settingsTab.display();
			});
		});

	if (!plugin.settings.anilistSync.enabled) return;

	new Setting(containerEl)
		.setName(tr('settings-sync-on-startup'))
		.setDesc(tr('settings-sync-on-startup-desc'))
		.addToggle((toggle) => {
			toggle.setValue(plugin.settings.anilistSync.syncOnStartup);
			toggle.onChange(async (value) => {
				plugin.settings.anilistSync.syncOnStartup = value;
				await plugin.saveSettings();
			});
		});

	new Setting(containerEl)
		.setName(tr('settings-sync-two-way'))
		.setDesc(tr('settings-sync-two-way-desc'))
		.addToggle((toggle) => {
			toggle.setValue(plugin.settings.anilistSync.twoWaySync);
			toggle.onChange(async (value) => {
				plugin.settings.anilistSync.twoWaySync = value;
				await plugin.saveSettings();
			});
		});
}

function createFieldsUI(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	const personalizationOn = plugin.settings.anilistAuth.personalizationEnabled;

	containerEl.createEl('h4', { text: tr('settings-anilist-fields-public') });

	new Setting(containerEl)
		.setDesc(tr('settings-anilist-fields-public-desc'))
		.addTextArea((text) => {
			text.setPlaceholder(tr('settings-anilist-fields-placeholder'));
			text.setValue(plugin.settings.anilistAuth.customFieldsPublic);
			text.inputEl.rows = 8;
			text.inputEl.cols = 40;
			text.inputEl.addClass('babylon-monospace-input');
			text.onChange(async (value) => {
				plugin.settings.anilistAuth.customFieldsPublic = value;
				await plugin.saveSettings();
				plugin.updateAnilistProvider();
			});
		});

	containerEl.createEl('h4', { text: tr('settings-anilist-fields-private') });

	const privateSetting = new Setting(containerEl)
		.setDesc(tr('settings-anilist-fields-private-desc'))
		.addTextArea((text) => {
			text.setPlaceholder(tr('settings-anilist-fields-placeholder'));
			text.setValue(plugin.settings.anilistAuth.customFieldsPrivate);
			text.inputEl.rows = 6;
			text.inputEl.cols = 40;
			text.inputEl.addClass('babylon-monospace-input');
			if (!personalizationOn) {
				text.inputEl.disabled = true;
			}
			text.onChange(async (value) => {
				plugin.settings.anilistAuth.customFieldsPrivate = value;
				await plugin.saveSettings();
				plugin.updateAnilistProvider();
			});
		});

	if (!personalizationOn) {
		privateSetting.setDesc(tr('settings-anilist-fields-private-disabled'));
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
		createSyncUI(containerEl, plugin);
	}

	if (animeSettings) {
		new Setting(containerEl)
			.setName(tr('settings-folder'))
			.setDesc(tr('settings-folder-desc'))
			.addText((text) =>
				text
					.setPlaceholder('Content/Anime')
					.setValue(animeSettings.folder)
					.onChange(async (value) => {
						animeSettings.folder = value;
						await plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr('settings-template'))
			.setDesc(tr('settings-template-desc'))
			.addText((text) =>
				text
					.setPlaceholder('TEMPLATES/anime-template.md')
					.setValue(animeSettings.templatePath)
					.onChange(async (value) => {
						animeSettings.templatePath = normalizePath(app, value);
						await plugin.saveSettings();
					}),
			);
	}

	createFieldsUI(containerEl, plugin);
}
