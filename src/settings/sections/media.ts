import { Setting, type App } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';
import type { MediaType } from '../../types';
import { createAnimeSection } from './anilist';

const MEDIA_TYPES: { key: MediaType; labelKey: string }[] = [
	{ key: 'anime', labelKey: 'settings-media-anime' },
	{ key: 'movie', labelKey: 'settings-media-movie' },
	{ key: 'series', labelKey: 'settings-media-series' },
	{ key: 'game', labelKey: 'settings-media-game' },
	{ key: 'book', labelKey: 'settings-media-book' },
];

export function normalizePath(app: App, input: string): string {
	let path = input.trim();
	if (!path) return '';
	const vaultPath = (app.vault.adapter as { basePath?: string }).basePath;
	if (vaultPath && path.startsWith(vaultPath)) {
		path = path.slice(vaultPath.length).replace(/^[/\\]+/, '');
	}
	return path;
}

function ensureMediaSettings(plugin: BabylonPlugin, key: MediaType): void {
	if (!plugin.settings.media[key]) {
		plugin.settings.media[key] = {
			enabled: key === 'anime',
			folder: '',
			provider: null,
			templatePath: '',
		};
	}
}

function createBasicSettings(
	section: HTMLElement,
	plugin: BabylonPlugin,
	key: MediaType,
): void {
	const settings = plugin.settings.media[key];
	if (!settings) return;
	const app = plugin.app;

	new Setting(section)
		.setName(tr('settings-folder'))
		.setDesc(tr('settings-folder-desc'))
		.addText((text) =>
			text
				.setPlaceholder('Content/' + key.charAt(0).toUpperCase() + key.slice(1))
				.setValue(settings.folder)
				.onChange(async (value) => {
					settings.folder = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(section)
		.setName(tr('settings-template'))
		.setDesc(tr('settings-template-desc'))
		.addText((text) =>
			text
				.setPlaceholder('TEMPLATES/' + key + '-template.md')
				.setValue(settings.templatePath)
				.onChange(async (value) => {
					settings.templatePath = normalizePath(app, value);
					await plugin.saveSettings();
				}),
		);
}

export function createMediaSection(
	containerEl: HTMLElement,
	plugin: BabylonPlugin,
): void {
	containerEl.createEl('h2', { text: tr('settings-media') });

	for (const mt of MEDIA_TYPES) {
		ensureMediaSettings(plugin, mt.key);
		const settings = plugin.settings.media[mt.key];
		if (!settings) continue;

		const section = containerEl.createDiv();

		new Setting(section)
			.setName(tr(mt.labelKey))
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

		if (mt.key === 'anime') {
			createAnimeSection(section, plugin);
		} else {
			createBasicSettings(section, plugin, mt.key);
			section.createEl('p', {
				text: tr('settings-coming-soon'),
				cls: 'setting-item-description',
			});
		}
	}
}
