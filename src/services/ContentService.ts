import { Notice, type App, type TFile } from 'obsidian';
import type { BabylonSettings, MediaDetails, MediaType } from '../types';
import { TemplateService } from './TemplateService';
import { sanitizeFilename } from '../utils/sanitize';
import { tr } from '../i18n';

export class ContentService {
	private app: App;
	private templateService: TemplateService;

	constructor(app: App) {
		this.app = app;
		this.templateService = new TemplateService(app);
	}

	async createNote(
		type: MediaType,
		details: MediaDetails,
		settings: BabylonSettings,
	): Promise<TFile | null> {
		const mediaSettings = settings.media[type];
		if (!mediaSettings) {
			new Notice(tr('create-note-error'));
			return null;
		}

		const folder = mediaSettings.folder || 'Content';
		const filename = `${sanitizeFilename(details.title)} - ${details.sourceId}.md`;
		const filePath = `${folder}/${filename}`;

		await this.ensureFolder(folder);

		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing) {
			new Notice(tr('file-exists'));
			return null;
		}

		const rendered = await this.templateService.render(
			mediaSettings.templatePath,
			details,
		);

		try {
			const file = await this.app.vault.create(filePath, rendered);
			new Notice(`${tr('create-note-success')}: ${details.title}`);
			return file;
		} catch (err) {
			console.error('Babylon: Failed to create note', err);
			new Notice(tr('create-note-error'));
			return null;
		}
	}

	private async ensureFolder(folder: string): Promise<void> {
		if (!folder) return;
		const parts = folder.split('/');
		let current = '';
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const exists = this.app.vault.getAbstractFileByPath(current);
			if (!exists) {
				try {
					await this.app.vault.createFolder(current);
				} catch {
					// ignore
				}
			}
		}
	}
}
