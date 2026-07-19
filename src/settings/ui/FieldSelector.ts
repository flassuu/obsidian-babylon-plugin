import { setIcon } from 'obsidian';
import type BabylonPlugin from '../../main';
import { tr } from '../../i18n';
import type { MediaType } from '../../types';
import { getCategories, getFieldsByCategory } from '../../fields/FieldRegistry';

export class FieldSelector {
	private plugin: BabylonPlugin;
	private mediaType: MediaType;
	private containerEl: HTMLElement;
	private selected: Set<string>;
	private personalEnabled: boolean;
	private onChanged: () => void;

	// DOM refs for incremental updates
	private catCheckboxes: Map<string, HTMLInputElement> = new Map();
	private fieldCheckboxes: Map<string, HTMLInputElement> = new Map();
	private catGrids: Map<string, HTMLElement> = new Map();

	constructor(
		plugin: BabylonPlugin,
		mediaType: MediaType,
		containerEl: HTMLElement,
		personalEnabled: boolean,
		onChanged: () => void,
	) {
		this.plugin = plugin;
		this.mediaType = mediaType;
		this.containerEl = containerEl;
		this.personalEnabled = personalEnabled;
		this.onChanged = onChanged;

		const settings = plugin.settings.media[mediaType];
		this.selected = new Set(settings?.selectedFields ?? []);

		this.render();
	}

	getSelected(): Set<string> {
		return this.selected;
	}

	private async toggleField(key: string): Promise<void> {
		if (this.selected.has(key)) {
			this.selected.delete(key);
		} else {
			this.selected.add(key);
		}
		// update the single checkbox immediately
		const cb = this.fieldCheckboxes.get(key);
		if (cb) cb.checked = this.selected.has(key);
		const cat = this.findCategoryForField(key);
		if (cat) this.updateSelectAll(cat);
		await this.save();
	}

	private findCategoryForField(key: string): string | undefined {
		const byCategory = getFieldsByCategory(this.mediaType);
		for (const [catId, fields] of byCategory) {
			if (fields.some((f) => f.key === key)) return catId;
		}
		return undefined;
	}

	private async selectCategory(categoryId: string, select: boolean): Promise<void> {
		const byCategory = getFieldsByCategory(this.mediaType);
		const fields = byCategory.get(categoryId) ?? [];
		for (const f of fields) {
			if (f.advanced) continue;
			const disabled = f.personal && !this.personalEnabled;
			if (disabled) continue;
			if (select) {
				this.selected.add(f.key);
			} else {
				this.selected.delete(f.key);
			}
			const cb = this.fieldCheckboxes.get(f.key);
			if (cb) cb.checked = this.selected.has(f.key);
		}
		this.updateSelectAll(categoryId);
		await this.save();
	}

	private updateSelectAll(categoryId: string): void {
		const byCategory = getFieldsByCategory(this.mediaType);
		const fields = byCategory.get(categoryId) ?? [];
		const allSelected = fields.every((f) => {
			if (f.advanced) return true;
			const disabled = f.personal && !this.personalEnabled;
			return disabled || this.selected.has(f.key);
		});
		const chk = this.catCheckboxes.get(categoryId);
		if (chk) chk.checked = allSelected;
	}

	private async save(): Promise<void> {
		const settings = this.plugin.settings.media[this.mediaType];
		if (settings) {
			settings.selectedFields = [...this.selected];
			await this.plugin.saveSettings();
			this.plugin.updateAnilistProvider();
		}
		this.onChanged();
	}

	render(): void {
		this.containerEl.empty();
		this.catCheckboxes.clear();
		this.fieldCheckboxes.clear();
		this.catGrids.clear();

		const categories = getCategories(this.mediaType);
		const byCategory = getFieldsByCategory(this.mediaType);

		for (const cat of categories) {
			const fields = byCategory.get(cat.id) ?? [];
			if (fields.length === 0) continue;

			const details = this.containerEl.createEl('details');
			details.open = true;

			const summary = details.createEl('summary');
			summary.addClass('babylon-field-summary');
			const iconSpan = summary.createSpan({ cls: 'babylon-field-cat-icon' });
			setIcon(iconSpan, cat.icon);
			summary.createSpan({ text: tr(cat.labelKey) });

			const allSelected = fields.every((f) => {
				const disabled = f.personal && !this.personalEnabled;
				return disabled || this.selected.has(f.key);
			});
			const chkLabel = summary.createEl('label', { cls: 'babylon-cat-select-all' });
			const chk = chkLabel.createEl('input', { attr: { type: 'checkbox' } });
			chk.checked = allSelected;
			chk.addEventListener('change', (e) => {
				e.stopPropagation();
				void this.selectCategory(cat.id, chk.checked);
			});
			chkLabel.createSpan({ text: tr('field-select-all') });
			this.catCheckboxes.set(cat.id, chk);

			const grid = details.createDiv({ cls: 'babylon-field-grid' });
			this.catGrids.set(cat.id, grid);

			for (const field of fields) {
				if (field.advanced) continue;
				const isPersonal = field.personal;
				const disabled = isPersonal && !this.personalEnabled;
				const checked = this.selected.has(field.key);

				const label = grid.createEl('label', { cls: 'babylon-field-item' });
				if (disabled) label.addClass('babylon-field-disabled');
				const cb = label.createEl('input', { attr: { type: 'checkbox' } });
				cb.checked = checked;
				cb.disabled = disabled;
				cb.addEventListener('change', () => {
					void this.toggleField(field.key);
				});
				label.createSpan({ text: tr(field.labelKey) });
				this.fieldCheckboxes.set(field.key, cb);
			}
		}
	}
}
