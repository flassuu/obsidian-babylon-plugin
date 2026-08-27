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

	const dateFormatSetting = new Setting(containerEl).setName(tr('settings-date-format'));
	const desc = dateFormatSetting.descEl.createSpan({ cls: 'babylon-date-format-desc' });
	desc.createSpan({ text: tr('settings-date-format-syntax-before') });
	desc.createEl('a', {
		text: tr('settings-date-format-syntax-link'),
		href: 'https://momentjs.com/docs/#/displaying/format/',
		attr: { target: '_blank', rel: 'noopener' },
	});
	desc.createEl('br');
	desc.createSpan({ text: tr('settings-date-format-current') });
	const previewEl = desc.createEl('b', {
		cls: 'u-pop',
		text: formatDate(new Date(), plugin.settings.dateFormat),
	});
	dateFormatSetting.addText((text) => {
		text.setPlaceholder('YYYY-MM-DD');
		text.setValue(plugin.settings.dateFormat);
		text.inputEl.addClass('babylon-date-format-input');
		text.onChange((value) => {
			plugin.settings.dateFormat = value;
			void plugin.saveSettings();
			previewEl.setText(formatDate(new Date(), value));
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
