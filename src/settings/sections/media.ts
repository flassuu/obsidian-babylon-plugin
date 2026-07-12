import { Setting } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';
import type { MediaType, ProviderId } from '../../types';

const MEDIA_TYPES: { key: MediaType; labelKey: string }[] = [
	{ key: 'anime', labelKey: 'settings-media-anime' },
	{ key: 'movie', labelKey: 'settings-media-movie' },
	{ key: 'series', labelKey: 'settings-media-series' },
];

const PROVIDER_OPTIONS: { id: ProviderId | ''; label: string }[] = [
	{ id: '', label: '—' },
	{ id: 'anilist', label: 'AniList' },
	{ id: 'omdb', label: 'OMDb' },
	{ id: 'rawg', label: 'RAWG' },
	{ id: 'steam', label: 'Steam' },
];

export function createMediaSection(
	containerEl: HTMLElement,
	plugin: BabylonPlugin,
): void {
	containerEl.createEl('h2', { text: tr('settings-media') });

	for (const mediaType of MEDIA_TYPES) {
		const settings = plugin.settings.media[mediaType.key];
		if (!settings) continue;

		const section = containerEl.createDiv();
		section.createEl('h3', { text: tr(mediaType.labelKey) });

		new Setting(section)
			.setName(tr('settings-enabled'))
			.addToggle((toggle) =>
				toggle
					.setValue(settings.enabled)
					.onChange(async (value) => {
						settings.enabled = value;
						await plugin.saveSettings();
						plugin.settingsTab?.display();
					}),
			);

		if (!settings.enabled) continue;

		new Setting(section)
			.setName(tr('settings-folder'))
			.setDesc(tr('settings-folder-desc'))
			.addText((text) =>
				text
					.setPlaceholder('content/anime')
					.setValue(settings.folder)
					.onChange(async (value) => {
						settings.folder = value;
						await plugin.saveSettings();
					}),
			);

		new Setting(section)
			.setName(tr('settings-provider'))
			.addDropdown((dropdown) => {
				for (const opt of PROVIDER_OPTIONS) {
					dropdown.addOption(opt.id, opt.label);
				}
				dropdown.setValue(settings.provider ?? '');
				dropdown.onChange(async (value: string) => {
					settings.provider = (value || null) as ProviderId | null;
					await plugin.saveSettings();
				});
			});

		new Setting(section)
			.setName(tr('settings-template'))
			.setDesc(tr('settings-template-desc'))
			.addText((text) =>
				text
					.setPlaceholder('Templates/anime-template.md')
					.setValue(settings.templatePath)
					.onChange(async (value) => {
						settings.templatePath = value;
						await plugin.saveSettings();
					}),
			);
	}
}
