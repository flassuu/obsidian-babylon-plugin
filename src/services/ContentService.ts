import { Notice, TFile, type App } from 'obsidian';
import type { BabylonSettings, MediaDetails, MediaType } from '../types';
import { TemplateService } from './TemplateService';
import { sanitizeFilename } from '../utils/sanitize';
import { tr } from '../i18n';
import { ConfirmModal } from '../ui/modals/ConfirmModal';

// creates and manages note files for tracked media
export class ContentService {
	private app: App;
	private templateService: TemplateService;

	constructor(app: App) {
		this.app = app;
		this.templateService = new TemplateService(app);
	}

	// create a note file from media details, rendering through the user's template
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
			const confirmed = await new Promise<boolean>((resolve) => {
				new ConfirmModal(
					this.app,
					tr('file-exists'),
					filePath,
					() => resolve(true),
					() => resolve(false),
				).open();
			});
			if (!confirmed) return null;
		}

		const rendered = await this.templateService.render(
			mediaSettings.templatePath,
			details,
		);

		try {
			let file: TFile | null = null;

			if (existing instanceof TFile) {
				await this.app.vault.modify(existing, rendered);
				file = existing;
			} else {
				file = await this.app.vault.create(filePath, rendered);
			}

			new Notice(`${tr('create-note-success')}: ${details.title}`);

			// auto-open newly created anime notes
			if (file && type === 'anime') {
				const leaf = this.app.workspace.getLeaf();
				if (leaf) {
					await leaf.openFile(file);
				}
			}

			return file;
		} catch (err) {
			console.error('Babylon: Failed to create note', err);
			new Notice(tr('create-note-error'));
			return null;
		}
	}

	// ensure a nested folder path exists, creating parents as needed
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
				} catch (e) {
					console.warn('Babylon: Failed to create folder', current, e);
				}
			}
		}
	}
}
