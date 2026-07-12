import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import type BabylonPlugin from '../main';
import { setLocale, tr } from '../i18n';
import { createGeneralSection } from './sections/general';
import { createApiSection } from './sections/api';
import { createMediaSection } from './sections/media';

export class BabylonSettingTab extends PluginSettingTab {
	plugin: BabylonPlugin;

	constructor(app: App, plugin: BabylonPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		// save scroll position and details states before re-render
		const scrollTop = containerEl.scrollTop;
		const detailsStates = new Map<string, boolean>();
		containerEl.querySelectorAll('details').forEach((el) => {
			const key = el.textContent?.trim() ?? '';
			detailsStates.set(key, el.open);
		});

		containerEl.empty();

		setLocale(this.plugin.settings.language);

		new Setting(containerEl).setName(tr('settings-heading')).setHeading();

		const aboutBox = containerEl.createDiv({ cls: 'babylon-about-box' });
		const left = aboutBox.createDiv({ cls: 'babylon-about-left' });

		const titleRow = left.createDiv({ cls: 'babylon-about-title-row' });
		titleRow.createSpan({ cls: 'babylon-about-name', text: this.plugin.manifest.name });
		titleRow.createSpan({ cls: 'babylon-about-version', text: 'v' + this.plugin.manifest.version });

		const authorP = left.createEl('p', { cls: 'babylon-about-author' });
		authorP.insertAdjacentText('afterbegin', 'by ');
		authorP.createEl('a', { href: 'https://github.com/flassuu', text: 'flassuu' });

		left.createEl('p', {
			cls: 'babylon-about-desc',
			text: tr('settings-about-desc'),
		});

		const right = aboutBox.createDiv({ cls: 'babylon-about-right' });

		function createDiscordIcon(parent: HTMLElement): void {
			const ns = 'http://www.w3.org/2000/svg';
			const svg = document.createElementNS(ns, 'svg');
			svg.setAttribute('viewBox', '0 0 127.14 96.36');
			svg.setAttribute('width', '18');
			svg.setAttribute('height', '18');
			const path = document.createElementNS(ns, 'path');
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', 'currentColor');
			path.setAttribute('stroke-width', '10');
			path.setAttribute('stroke-linecap', 'round');
			path.setAttribute('stroke-linejoin', 'round');
			path.setAttribute('d', 'M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z');
			svg.appendChild(path);
			parent.appendChild(svg);
		}

		const links: Array<{
			icon?: string;
			discordSvg?: true;
			label: string;
			url: string;
		}> = [
			{ icon: 'github', label: tr('settings-about-github'), url: tr('settings-about-github-url') },
			{ discordSvg: true, label: tr('settings-about-discord'), url: tr('settings-about-discord-url') },
			{ icon: 'message-square', label: tr('settings-about-discussions'), url: tr('settings-about-discussions-url') },
			{ icon: 'heart', label: tr('settings-about-donate'), url: tr('settings-about-donate-url') },
		];

		for (const link of links) {
			const btn = right.createEl('a', { cls: 'babylon-about-btn', href: link.url });
			if (link.discordSvg) {
				createDiscordIcon(btn);
			} else if (link.icon) {
				setIcon(btn, link.icon);
			}
			btn.createSpan({ text: link.label });
		}

		createGeneralSection(containerEl, this.plugin);
		createMediaSection(containerEl, this.plugin);
		createApiSection(containerEl, this.plugin);

		// restore scroll position and details states
		containerEl.scrollTop = scrollTop;
		containerEl.querySelectorAll('details').forEach((el) => {
			const key = el.textContent?.trim() ?? '';
			const wasOpen = detailsStates.get(key);
			if (wasOpen !== undefined) {
				el.open = wasOpen;
			}
		});
	}
}
