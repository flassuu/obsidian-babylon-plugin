import { Setting } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';

export function createApiSection(
	containerEl: HTMLElement,
	plugin: BabylonPlugin,
): void {
	new Setting(containerEl)
		.setName(tr('settings-api-key-omdb'))
		.setDesc(tr('settings-api-key-omdb-desc'))
		.addText((text) =>
			text
				.setPlaceholder('https://omdbapi.com')
				.setValue(plugin.settings.apiKeys.omdb)
				.onChange(async (value) => {
					plugin.settings.apiKeys.omdb = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName(tr('settings-api-key-rawg'))
		.setDesc(tr('settings-api-key-rawg-desc'))
		.addText((text) =>
			text
				.setPlaceholder('https://rawg.io')
				.setValue(plugin.settings.apiKeys.rawg)
				.onChange(async (value) => {
					plugin.settings.apiKeys.rawg = value;
					await plugin.saveSettings();
				}),
		);
}
