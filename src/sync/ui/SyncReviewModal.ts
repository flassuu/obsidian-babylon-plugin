import { Modal, Notice, Setting, setIcon } from 'obsidian';
import type { NoteSyncChange, SyncFieldChange } from '../types';
import { tr } from '../../i18n';
import { SyncEngine } from '../SyncEngine';
import { NoteIgnoreStore } from '../NoteIgnoreStore';
import type BabylonPlugin from '../../main';
import { preserveReRenderState } from '../../utils/scroll';

export interface SyncReviewResult {
	applied: boolean;
}

export class SyncReviewModal extends Modal {
	private plugin: BabylonPlugin;
	private changes: NoteSyncChange[];
	private engine: SyncEngine;
	private ignoreStore: NoteIgnoreStore;

	// per-field selection state: key = `${sourceId}::${fieldKey}`
	private selected: Set<string> = new Set();
	private expanded: Set<string> = new Set();

	constructor(
		plugin: BabylonPlugin,
		changes: NoteSyncChange[],
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.changes = changes;
		this.engine = new SyncEngine(plugin);
		this.ignoreStore = new NoteIgnoreStore(plugin);

		// default: all changes selected
		for (const nc of changes) {
			for (const ch of nc.changes) {
				this.selected.add(`${nc.sourceId}::${ch.fieldKey}`);
			}
		}

		this.titleEl.setText(tr('sync-review-title'));
	}

	onOpen(): void {
		this.render();
	}

	private render(): void {
		const { contentEl } = this;

		// keep scroll position when toggling a note/field re-renders the list
		preserveReRenderState(contentEl, () => {
			contentEl.empty();
			this.renderBody(contentEl);
		});
	}

	private renderBody(contentEl: HTMLElement): void {
		if (this.changes.length === 0) {
			contentEl.createEl('p', { text: tr('sync-no-changes') });
			return;
		}

		const summaryEl = contentEl.createDiv({ cls: 'babylon-sync-summary' });
		summaryEl.createEl('p', {
			text: `Found ${this.changes.length} note(s) with changes`,
		});

		const listEl = contentEl.createDiv({ cls: 'babylon-sync-list' });

		for (const nc of this.changes) {
			const noteEl = listEl.createDiv({ cls: 'babylon-sync-note' });
			const headerEl = noteEl.createDiv({ cls: 'babylon-sync-note-header' });

			// note-level toggle
			const noteToggle = headerEl.createEl('input', {
				attr: { type: 'checkbox' },
			});
			const allSelected = nc.changes.every((ch) =>
				this.selected.has(`${nc.sourceId}::${ch.fieldKey}`),
			);
			noteToggle.checked = allSelected;
			noteToggle.addEventListener('change', () => {
				for (const ch of nc.changes) {
					const key = `${nc.sourceId}::${ch.fieldKey}`;
					if (noteToggle.checked) {
						this.selected.add(key);
					} else {
						this.selected.delete(key);
					}
				}
				this.render();
			});

			// expand/collapse arrow
			const arrowSpan = headerEl.createSpan({ cls: 'babylon-sync-arrow' });
			const isExpanded = this.expanded.has(nc.sourceId);
			setIcon(arrowSpan, isExpanded ? 'chevron-down' : 'chevron-right');
			arrowSpan.addEventListener('click', () => {
				if (isExpanded) {
					this.expanded.delete(nc.sourceId);
				} else {
					this.expanded.add(nc.sourceId);
				}
				this.render();
			});

			// note title
			headerEl.createSpan({
				text: `${nc.title} (${nc.changes.length} change(s))`,
				cls: 'babylon-sync-note-title',
			});

			// field list (collapsible)
			if (isExpanded) {
				const fieldListEl = noteEl.createDiv({ cls: 'babylon-sync-fields' });
				for (const ch of nc.changes) {
					this.renderFieldRow(fieldListEl, nc.sourceId, ch);
				}
			}
		}

		// action buttons
		const btnEl = contentEl.createDiv({ cls: 'babylon-sync-actions' });
		new Setting(btnEl)
			.addButton((b) =>
				b.setButtonText(tr('sync-apply-selected'))
					.setCta()
					.onClick(() => this.applySelected()),
			)
			.addButton((b) =>
				b.setButtonText(tr('sync-apply-all'))
					.onClick(() => this.applyAll()),
			)
			.addButton((b) =>
				b.setButtonText(tr('sync-skip-all'))
					.onClick(() => this.close()),
			);
	}

	private renderFieldRow(
		container: HTMLElement,
		sourceId: string,
		change: SyncFieldChange,
	): void {
		const key = `${sourceId}::${change.fieldKey}`;
		const isChecked = this.selected.has(key);

		const row = container.createDiv({ cls: 'babylon-sync-field-row' });

		// field toggle
		const cb = row.createEl('input', { attr: { type: 'checkbox' } });
		cb.checked = isChecked;
		cb.addEventListener('change', () => {
			if (cb.checked) {
				this.selected.add(key);
			} else {
				this.selected.delete(key);
			}
		});

		// field info — show the frontmatter property name as the label
		const label = change.propertyName;
		const localStr = change.localValue ?? '—';
		const remoteStr = change.remoteValue ?? '—';
		row.createSpan({
			text: `${label}: ${localStr} → ${remoteStr}`,
			cls: 'babylon-sync-field-label',
		});

		// ignore button
		const ignoreBtn = row.createEl('button', {
			cls: 'babylon-sync-ignore-btn',
		});
		setIcon(ignoreBtn, 'eye-off');
		ignoreBtn.addEventListener('click', () => {
			void this.ignoreStore.addIgnoredField(sourceId, change.fieldKey).then(() => {
				this.selected.delete(key);
				new Notice(`"${change.fieldKey}" ignored for this note. Manage ignores in settings.`);
				this.render();
			});
		});
	}

	private async applySelected(): Promise<void> {
		const filtered: NoteSyncChange[] = [];
		for (const nc of this.changes) {
			const selectedChanges = nc.changes.filter((ch) =>
				this.selected.has(`${nc.sourceId}::${ch.fieldKey}`),
			);
			if (selectedChanges.length > 0) {
				filtered.push({ ...nc, changes: selectedChanges });
			}
		}
		if (filtered.length === 0) return;
		await this.engine.applyChanges(filtered);
		this.close();
	}

	private async applyAll(): Promise<void> {
		await this.engine.applyChanges(this.changes);
		this.close();
	}
}
