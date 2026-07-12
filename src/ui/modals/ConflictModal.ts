import { Modal, type App } from 'obsidian';
import type { SyncConflict } from '../../types';
import { tr } from '../../i18n';

export type ConflictResolution = 'keep-local' | 'use-remote' | 'push-to-anilist' | 'skip';

export class ConflictModal extends Modal {
	private resolved = false;

	constructor(
		app: App,
		private conflict: SyncConflict,
		private onResolve: (resolution: ConflictResolution) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: tr('conflict-title') });
		contentEl.createEl('p', { text: tr('conflict-desc', { title: this.conflict.title }) });

		const tableEl = contentEl.createEl('table', { cls: 'babylon-conflict-table' });

		const thead = tableEl.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Field' });
		headerRow.createEl('th', { text: tr('conflict-local') });
		headerRow.createEl('th', { text: tr('conflict-remote') });

		const tbody = tableEl.createEl('tbody');

		const fields: Array<{ key: keyof SyncConflict; labelKey: string }> = [
			{ key: 'localStatus', labelKey: 'conflict-field-status' },
			{ key: 'localScore', labelKey: 'conflict-field-score' },
			{ key: 'localProgress', labelKey: 'conflict-field-progress' },
			{ key: 'localNote', labelKey: 'conflict-field-notes' },
		];

		for (const field of fields) {
			const localVal = this.conflict[field.key];
			const remoteKey = field.key.replace('local', 'remote') as keyof SyncConflict;
			const remoteVal = this.conflict[remoteKey];
			if (localVal === null && remoteVal === null) continue;
			if (String(localVal) === String(remoteVal)) continue;

			const row = tbody.createEl('tr');
			row.createEl('td', { text: tr(field.labelKey), cls: 'babylon-conflict-field' });
			row.createEl('td', { text: localVal !== null ? String(localVal) : '\u2014' });
			row.createEl('td', { text: remoteVal !== null ? String(remoteVal) : '\u2014' });
		}

		contentEl.createEl('hr');

		if (!this.resolved) {
			const btnContainer = contentEl.createDiv({ cls: 'babylon-conflict-buttons' });

			this.addResolveBtn(btnContainer, 'keep-local', 'mod-cta');
			this.addResolveBtn(btnContainer, 'use-remote', 'mod-cta');
			this.addResolveBtn(btnContainer, 'push-to-anilist', '');
			this.addResolveBtn(btnContainer, 'skip', '');
		}
	}

	private addResolveBtn(container: HTMLElement, action: ConflictResolution, cls: string): void {
		const btn = container.createEl('button', {
			text: tr(action.replace(/-/g, '_')),
			cls,
		});
		btn.addEventListener('click', () => {
			this.resolved = true;
			this.close();
			this.onResolve(action);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
