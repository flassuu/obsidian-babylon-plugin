import { App, PluginSettingTab } from 'obsidian';
import BabylonPlugin from './main';

export interface BabylonSettings {
	language: string;
}

export const DEFAULT_SETTINGS: BabylonSettings = {
	language: 'en',
};

export class BabylonSettingTab extends PluginSettingTab {
	plugin: BabylonPlugin;

	constructor(app: App, plugin: BabylonPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
	}
}
