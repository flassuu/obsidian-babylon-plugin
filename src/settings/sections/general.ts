import { Setting } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';
import type { SupportedLocale } from '../../types';
import { addFolderPicker } from '../ui/FolderPicker';
import { formatDate } from '../../utils/date';

export function createGeneralSection(
	containerEl: HTMLElement,
	plugin: BabylonPlugin,
): void {
	new Setting(containerEl)
		.setName(tr('settings-language'))
		.setDesc(tr('settings-language-desc'))
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

	const dateFormatSetting = new Setting(containerEl)
		.setName(tr('settings-date-format'))
		.setDesc(tr('settings-date-format-hint'));
	const preview = dateFormatSetting.descEl.createSpan({
		cls: 'babylon-date-format-preview',
		text: formatDate(new Date(), plugin.settings.dateFormat),
	});
	dateFormatSetting.addText((text) => {
		text.setPlaceholder('YYYY-MM-DD');
		text.setValue(plugin.settings.dateFormat);
		text.inputEl.addClass('babylon-date-format-input');
		text.onChange((value) => {
			plugin.settings.dateFormat = value;
			void plugin.saveSettings();
			preview.setText(formatDate(new Date(), value));
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
