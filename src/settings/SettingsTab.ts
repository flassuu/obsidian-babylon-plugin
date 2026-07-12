import { App, PluginSettingTab } from 'obsidian';
import type BabylonPlugin from '../main';
import { setLocale } from '../i18n';
import { createGeneralSection } from './sections/general';
import { createApiSection } from './sections/api';
import { createMediaSection } from './sections/media';
import { createAnilistSection } from './sections/anilist';

export class BabylonSettingTab extends PluginSettingTab {
	plugin: BabylonPlugin;

	constructor(app: App, plugin: BabylonPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		setLocale(this.plugin.settings.language);

		createGeneralSection(containerEl, this.plugin);
		createAnilistSection(containerEl, this.plugin);
		createApiSection(containerEl, this.plugin);
		createMediaSection(containerEl, this.plugin);
	}
}
