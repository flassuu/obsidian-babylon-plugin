import { Modal, Setting, setIcon } from 'obsidian';
import type BabylonPlugin from '../../main';
import type { MediaType } from '../../types';
import { getFieldsByCategory, getCategories } from '../../fields/FieldRegistry';
import type { SyncFieldMap, SyncFieldSetting } from '../types';
import { loadFieldMap, saveFieldMap, makeFieldMapPath, getDefaultFieldMap } from '../SyncFieldMap';
import { tr } from '../../i18n';

interface EditableField {
	key: string;
	label: string;
	category: string;
	defType: string;
	inMap: boolean;
	sync: boolean;
	property: string;
	originalIndex: number;
}

export class FieldMapEditorModal extends Modal {
	private plugin: BabylonPlugin;
	private mediaType: MediaType;
	private fields: EditableField[] = [];
	private filterText = '';
	private dirty = false;

	constructor(plugin: BabylonPlugin, mediaType: MediaType) {
		super(plugin.app);
		this.plugin = plugin;
		this.mediaType = mediaType;
		this.titleEl.setText(tr('field-map-editor-title'));
	}

	async onOpen(): Promise<void> {
		await this.loadData();
		this.render();
	}

	private async loadData(): Promise<void> {
		const mapPath = `${this.plugin.settings.templateFolder}/${makeFieldMapPath(this.mediaType)}`;
		let map = await loadFieldMap(this.plugin.app, mapPath);
		if (!map) {
			map = getDefaultFieldMap(this.mediaType);
		}

		const byCategory = getFieldsByCategory(this.mediaType);
		const categories = getCategories(this.mediaType);

		// collect all field definitions, in category order
		const orderedDefs: { key: string; category: string; type: string }[] = [];
		for (const cat of categories) {
			const catFields = byCategory.get(cat.id);
			if (catFields) {
				for (const f of catFields) {
					orderedDefs.push({ key: f.key, category: f.category, type: f.type });
				}
			}
		}

		// collect custom fields (in map but not in definitions)
		const defKeys = new Set(orderedDefs.map((d) => d.key));
		const customSettings = map.syncFields.filter((sf) => !defKeys.has(sf.key));

		this.fields = [];

		for (let i = 0; i < orderedDefs.length; i++) {
			const def = orderedDefs[i]!;
			const setting = map.syncFields.find((sf) => sf.key === def.key);
			this.fields.push({
				key: def.key,
				label: tr(`field-${def.key}`),
				category: def.category,
				defType: def.type,
				inMap: !!setting,
				sync: setting?.sync ?? false,
				property: setting?.property ?? def.key,
				originalIndex: i,
			});
		}

		// add custom fields at the end
		for (const cs of customSettings) {
			this.fields.push({
				key: cs.key,
				label: cs.key,
				category: '_custom',
				defType: cs.type,
				inMap: true,
				sync: cs.sync,
				property: cs.property,
				originalIndex: -1,
			});
		}
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		// search filter
		const searchInput = contentEl.createEl('input', {
			cls: 'babylon-field-map-search',
			attr: { type: 'text', placeholder: tr('field-map-editor-filter') },
		});
		searchInput.value = this.filterText;
		searchInput.addEventListener('input', () => {
			this.filterText = searchInput.value.toLowerCase();
			this.render();
		});

		// scrollable list
		const listEl = contentEl.createDiv({ cls: 'babylon-field-map-list' });

		const filtered = this.filterText
			? this.fields.filter(
					(f) =>
						f.key.toLowerCase().includes(this.filterText) ||
						f.property.toLowerCase().includes(this.filterText) ||
						f.label.toLowerCase().includes(this.filterText),
				)
			: this.fields;

		// group filtered by category
		const grouped = new Map<string, EditableField[]>();
		const categories = getCategories(this.mediaType);
		for (const f of filtered) {
			const cat = f.category;
			const arr = grouped.get(cat) ?? [];
			arr.push(f);
			grouped.set(cat, arr);
		}

		// render categories in original order
		for (const cat of categories) {
			const catFields = grouped.get(cat.id);
			if (!catFields) continue;
			this.renderCategory(listEl, cat.id, cat.labelKey, cat.icon, catFields);
		}

		// custom fields section
		const customFields = grouped.get('_custom');
		if (customFields) {
			this.renderCategory(listEl, '_custom', 'field-map-editor-custom', 'puzzle', customFields);
		}

		if (filtered.length === 0) {
			listEl.createEl('p', {
				text: tr('field-map-editor-no-results'),
				cls: 'babylon-field-map-empty',
			});
		}

		// action buttons
		const actionsEl = contentEl.createDiv({ cls: 'babylon-field-map-actions' });
		new Setting(actionsEl)
			.addButton((b) =>
				b.setButtonText(tr('field-map-editor-save'))
					.setCta()
					.onClick(() => this.save()),
			)
			.addButton((b) =>
				b.setButtonText(tr('cancel'))
					.onClick(() => this.close()),
			);
	}

	private renderCategory(
		container: HTMLElement,
		catId: string,
		labelKey: string,
		icon: string,
		catFields: EditableField[],
	): void {
		const sectionEl = container.createDiv({ cls: 'babylon-field-map-category' });

		const headerEl = sectionEl.createDiv({ cls: 'babylon-field-map-cat-header' });

		// category toggle all
		const allSync = catFields.every((f) => f.sync);
		const catToggle = headerEl.createEl('input', {
			attr: { type: 'checkbox' },
		});
		catToggle.checked = allSync;
		catToggle.addEventListener('change', () => {
			for (const f of catFields) {
				f.sync = catToggle.checked;
				if (!f.inMap) {
					f.inMap = true;
					f.property = f.key;
				}
			}
			this.dirty = true;
			this.render();
		});

		// icon + label
		const iconSpan = headerEl.createSpan({ cls: 'babylon-field-map-cat-icon' });
		setIcon(iconSpan, icon);

		headerEl.createSpan({
			text: tr(labelKey),
			cls: 'babylon-field-map-cat-label',
		});

		const countEl = headerEl.createSpan({ cls: 'babylon-field-map-cat-count' });
		const synced = catFields.filter((f) => f.sync).length;
		countEl.textContent = `${synced}/${catFields.length}`;

		// field rows
		const bodyEl = sectionEl.createDiv({ cls: 'babylon-field-map-cat-body' });
		for (const f of catFields) {
			this.renderFieldRow(bodyEl, f);
		}
	}

	private renderFieldRow(container: HTMLElement, field: EditableField): void {
		const row = container.createDiv({ cls: 'babylon-field-map-row' });
		row.toggleClass('babylon-field-map-row-disabled', !field.inMap);

		// sync toggle
		const cb = row.createEl('input', {
			attr: { type: 'checkbox' },
		});
		cb.checked = field.sync;
		cb.addEventListener('change', () => {
			field.sync = cb.checked;
			if (!field.inMap) {
				field.inMap = true;
				field.property = field.key;
			}
			this.dirty = true;
			this.render();
		});

		// label + key
		const labelEl = row.createDiv({ cls: 'babylon-field-map-info' });
		labelEl.createSpan({ text: field.label, cls: 'babylon-field-map-label' });
		labelEl.createSpan({ text: field.key, cls: 'babylon-field-map-key' });

		// property name input
		const propInput = row.createEl('input', {
			cls: 'babylon-field-map-prop',
			attr: {
				type: 'text',
				value: field.inMap ? field.property : '',
				placeholder: field.key,
			},
		});
		propInput.disabled = !field.inMap;
		propInput.addEventListener('input', () => {
			field.property = propInput.value.trim() || field.key;
			field.inMap = true;
			this.dirty = true;
		});

		// move buttons — only for synced, mapped fields
		const moveEl = row.createDiv({ cls: 'babylon-field-map-move' });
		if (field.sync && field.inMap) {
			const upBtn = moveEl.createEl('button', { cls: 'babylon-field-map-move-btn' });
			setIcon(upBtn, 'chevron-up');
			upBtn.addEventListener('click', () => this.moveField(field, -1));

			const downBtn = moveEl.createEl('button', { cls: 'babylon-field-map-move-btn' });
			setIcon(downBtn, 'chevron-down');
			downBtn.addEventListener('click', () => this.moveField(field, 1));
		}
	}

	private moveField(field: EditableField, dir: -1 | 1): void {
		const idx = this.fields.indexOf(field);
		if (idx === -1) return;
		const target = idx + dir;
		if (target < 0 || target >= this.fields.length) return;
		// swap — but only within the same category
		const neighbor = this.fields[target]!;
		if (neighbor.category !== field.category) return;
		[this.fields[idx], this.fields[target]] = [this.fields[target]!, this.fields[idx]!];
		this.dirty = true;
		this.render();
	}

	private async save(): Promise<void> {
		const mapPath = `${this.plugin.settings.templateFolder}/${makeFieldMapPath(this.mediaType)}`;

		const syncFields: SyncFieldSetting[] = [];
		for (const f of this.fields) {
			if (!f.inMap) continue;
			syncFields.push({
				key: f.key,
				property: f.property,
				type: f.defType as SyncFieldSetting['type'],
				sync: f.sync,
			});
		}

		const map: SyncFieldMap = {
			version: 1,
			mediaType: this.mediaType,
			syncFields,
		};

		await saveFieldMap(this.plugin.app, mapPath, map);
		this.close();
	}
}
