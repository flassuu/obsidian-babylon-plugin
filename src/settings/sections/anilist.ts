import { Setting } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';
import { getAnilistAuthUrl, testAnilistToken } from '../../utils/fetcher';

const CLIENT_ID = '45744';

export function createAnilistSection(containerEl: HTMLElement, plugin: BabylonPlugin): void {
	containerEl.createEl('h2', { text: tr('settings-anilist') });

	containerEl.createEl('h3', { text: tr('settings-anilist-auth') });

	new Setting(containerEl)
		.setName(tr('settings-anilist-personalization'))
		.setDesc(tr('settings-anilist-personalization-desc'))
		.addToggle((toggle) => {
			toggle.setValue(plugin.settings.anilistAuth.personalizationEnabled);
			toggle.onChange(async (value) => {
				plugin.settings.anilistAuth.personalizationEnabled = value;
				await plugin.saveSettings();
				plugin.settingsTab.display();
			});
		});

	if (!plugin.settings.anilistAuth.personalizationEnabled) return;

	const desc = containerEl.createDiv({ cls: 'setting-item-description' });
	desc.createEl('p', { text: tr('settings-anilist-auth-desc') });
	desc.createEl('ol', { cls: 'babylon-auth-steps' }, (ol) => {
		ol.createEl('li', { text: tr('settings-anilist-step-click') });
		ol.createEl('li', { text: tr('settings-anilist-step-approve') });
		ol.createEl('li', { text: tr('settings-anilist-step-copy') });
	});

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

	containerEl.createEl('h3', { text: tr('settings-sync-anilist') });

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

	if (!plugin.settings.anilistSync.enabled || !plugin.settings.anilistAuth.accessToken) return;

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

	containerEl.createEl('h3', { text: tr('settings-anilist-custom-fields') });

	const baseInfo = containerEl.createEl('p', { cls: 'setting-item-description' });
	baseInfo.createEl('strong', { text: tr('settings-anilist-base-fields') });
	baseInfo.createEl('br');
	baseInfo.appendText(tr('settings-anilist-base-fields-desc'));

	new Setting(containerEl)
		.setDesc(tr('settings-anilist-custom-fields-desc'))
		.addTextArea((text) => {
			text.setPlaceholder(tr('settings-anilist-custom-fields-placeholder'));
			text.setValue(plugin.settings.anilistAuth.customFields);
			text.inputEl.rows = 6;
			text.inputEl.cols = 40;
			text.inputEl.addClass('babylon-monospace-input');
			text.onChange(async (value) => {
				plugin.settings.anilistAuth.customFields = value;
				await plugin.saveSettings();
				plugin.updateAnilistProvider();
			});
		});
}
