import { Modal, type App } from 'obsidian';
import { tr } from '../../i18n';

export class ConfirmModal extends Modal {
	private resolved = false;

	constructor(
		app: App,
		private title: string,
		private message: string,
		private onConfirm: () => void,
		private onCancel?: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.title });
		contentEl.createEl('p', { text: this.message });

		const btnContainer = contentEl.createDiv({ cls: 'babylon-confirm-buttons' });

		const cancelBtn = btnContainer.createEl('button', { text: tr('no') });
		cancelBtn.addEventListener('click', () => {
			this.resolved = true;
			this.close();
			this.onCancel?.();
		});

		const confirmBtn = btnContainer.createEl('button', {
			text: tr('yes'),
			cls: 'mod-cta',
		});
		confirmBtn.addEventListener('click', () => {
			this.resolved = true;
			this.close();
			this.onConfirm();
		});
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) {
			this.onCancel?.();
		}
	}
}
