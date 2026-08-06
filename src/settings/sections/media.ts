import { Setting, type App } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';
import type { MediaType } from '../../types';
import { createAnimeSection } from './anilist';
import { addFolderPicker } from '../ui/FolderPicker';
import { createCollapsible, createObsidianToggle } from '../ui/CollapsibleSection';

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
	const existing = plugin.settings.media[key];
	if (!existing) {
		plugin.settings.media[key] = {
			enabled: key === 'anime',
			folder: '',
			provider: null,
			templatePath: '',
			selectedFields: [],
			customFieldNames: [],
			templateMode: 'simple',
		};
	} else {
		if (!('selectedFields' in existing)) (existing as Record<string, unknown>).selectedFields = [];
		if (!('customFieldNames' in existing)) (existing as Record<string, unknown>).customFieldNames = [];
		if (!('templateMode' in existing)) (existing as Record<string, unknown>).templateMode = 'simple';
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

	const folderSetting = new Setting(section)
		.setName(tr('settings-folder'))
		.setDesc(tr('settings-folder-desc'));

	addFolderPicker(
		folderSetting,
		plugin.app,
		settings.folder,
		(value) => {
			settings.folder = value;
			void plugin.saveSettings();
		},
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
	for (const mt of MEDIA_TYPES) {
		ensureMediaSettings(plugin, mt.key);
		const settings = plugin.settings.media[mt.key];
		if (!settings) continue;

		// each media type is a collapsible group with an enable toggle in the header
		const section = createCollapsible(containerEl, {
			title: tr(mt.labelKey),
			defaultOpen: mt.key === 'anime' && settings.enabled,
			key: `media-${mt.key}`,
			level: 2,
			headerControl: (controls) => {
				createObsidianToggle(controls, settings.enabled, (value) => {
					settings.enabled = value;
					void plugin.saveSettings();
					// collapse the group when the type is disabled
					if (!value) section.setOpen(false);
				}, tr(mt.labelKey));
			},
		});

		if (mt.key === 'anime') {
			createAnimeSection(section.body, plugin);
		} else {
			createBasicSettings(section.body, plugin, mt.key);
			section.body.createEl('p', {
				text: tr('settings-coming-soon'),
				cls: 'setting-item-description',
			});
		}
	}
}
