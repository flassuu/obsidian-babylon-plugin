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
	private customFields: string[];
	private personalEnabled: boolean;
	private onChanged: () => void;

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
		this.customFields = settings?.customFieldNames ?? [];

		this.render();
	}

	private async toggleField(key: string): Promise<void> {
		if (this.selected.has(key)) {
			this.selected.delete(key);
		} else {
			this.selected.add(key);
		}
		await this.save();
	}

	private async selectCategory(categoryId: string, select: boolean): Promise<void> {
		const byCategory = getFieldsByCategory(this.mediaType);
		const fields = byCategory.get(categoryId) ?? [];
		for (const f of fields) {
			const disabled = f.personal && !this.personalEnabled;
			if (disabled) continue;
			if (select) {
				this.selected.add(f.key);
			} else {
				this.selected.delete(f.key);
			}
		}
		await this.save();
		this.render();
	}

	private async save(): Promise<void> {
		const settings = this.plugin.settings.media[this.mediaType];
		if (settings) {
			settings.selectedFields = [...this.selected];
			settings.customFieldNames = this.customFields;
			await this.plugin.saveSettings();
			this.plugin.updateAnilistProvider();
		}
		this.onChanged();
	}

	private async addCustomField(value: string): Promise<void> {
		const name = value.trim();
		if (!name || this.customFields.includes(name)) return;
		this.customFields.push(name);
		this.selected.add(name);
		await this.save();
		this.render();
	}

	private async removeCustomField(name: string): Promise<void> {
		this.customFields = this.customFields.filter((f) => f !== name);
		this.selected.delete(name);
		await this.save();
		this.render();
	}

	render(): void {
		this.containerEl.empty();

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

			// select-all checkbox
			const allSelected = fields.every((f) => {
				const disabled = f.personal && !this.personalEnabled;
				return disabled || this.selected.has(f.key);
			});
			const chkLabel = summary.createSpan({ cls: 'babylon-cat-select-all' });
			const chk = chkLabel.createEl('input', { attr: { type: 'checkbox' } });
			chk.checked = allSelected;
			chk.addEventListener('change', (e) => {
				e.stopPropagation();
				void this.selectCategory(cat.id, chk.checked);
			});
			chkLabel.createSpan({ text: tr('field-select-all') });

			const grid = details.createDiv({ cls: 'babylon-field-grid' });

			for (const field of fields) {
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
			}
		}
	}
}
