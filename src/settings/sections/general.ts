import { Setting } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';
import type { SupportedLocale } from '../../types';
import { addFolderPicker } from '../ui/FolderPicker';

export function createGeneralSection(
	containerEl: HTMLElement,
	plugin: BabylonPlugin,
): void {
	containerEl.createEl('h2', { text: tr('settings-general') });

	new Setting(containerEl)
		.setName(tr('settings-language'))
		.addDropdown((dropdown) => {
			dropdown
				.addOption('en', 'English')
				.addOption('ru', 'Русский')
				.setValue(plugin.settings.language)
				.onChange(async (value: string) => {
					plugin.settings.language = value as SupportedLocale;
					await plugin.saveSettings();
				});
		});

	const templateFolderSetting = new Setting(containerEl)
		.setName(tr('settings-template-folder'))
		.setDesc(tr('settings-template-folder-desc'));

	addFolderPicker(
		templateFolderSetting,
		plugin.app,
		plugin.settings.templateFolder,
		(value) => {
			plugin.settings.templateFolder = value;
			void plugin.saveSettings();
		},
	);
}
