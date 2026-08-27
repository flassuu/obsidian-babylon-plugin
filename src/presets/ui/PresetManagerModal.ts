import { App, FuzzySuggestModal, Modal, Notice, Setting, setIcon, TFile } from 'obsidian';
import type BabylonPlugin from '../../main';
import type { MediaType } from '../../types';
import { getFields, getFieldsByCategory, getCategories } from '../../fields/FieldRegistry';
import type { FieldCase, FieldFormat, MediaPreset, PresetCollection, PresetField, PresetFieldType } from '../types';
import { makeFieldId, PRESET_COLLECTION_VERSION } from '../types';
import {
	loadPresets,
	savePresets,
	makePresetPath,
	ensureSingleDefault,
} from '../PresetStore';
import { buildDefaultPreset, makeCopyName } from '../PresetFieldFactory';
import { tr } from '../../i18n';
import { ConfirmModal } from '../../ui/modals/ConfirmModal';
import { addFilePicker } from '../../settings/ui/FolderPicker';
import { preserveReRenderState } from '../../utils/scroll';

const FIELD_TYPES: PresetFieldType[] = ['string', 'number', 'date', 'boolean', 'array', 'object'];
const CASE_OPTIONS: FieldCase[] = ['none', 'lower', 'upper', 'capitalize', 'title'];
const DATE_OPTIONS = ['', 'YYYY-MM-DD', 'DD.MM.YYYY', 'YYYY/MM/DD', 'D MMM YYYY'];

interface MapRow {
	from: string;
	to: string;
}

// pick an apiKey from the registered fields (or type your own)
class FieldSuggestModal extends FuzzySuggestModal<string> {
	constructor(
		app: App,
		private items: string[],
		private onSelect: (key: string) => void,
	) {
		super(app);
		this.setPlaceholder('Choose an API field');
	}

	getItems(): string[] {
		return this.items;
	}

	getItemText(item: string): string {
		return item;
	}

	onChooseItem(item: string): void {
		this.onSelect(item);
	}
}

// quick field-selector, mirroring the legacy FieldSelector mechanics:
// categories with per-category "select all" + per-field checkboxes; personal
// fields are locked out while personalization is disabled.
class FieldQuickPickModal extends Modal {
	private catCheckboxes: Map<string, HTMLInputElement> = new Map();
	private fieldCheckboxes: Map<string, HTMLInputElement> = new Map();
	private selected: Set<string>;

	constructor(
		app: App,
		private mediaType: MediaType,
		private initial: string[],
		private personalOn: boolean,
		private onApply: (selected: string[]) => void,
	) {
		super(app);
		this.selected = new Set(initial);
		this.titleEl.setText(tr('preset-fields-add-title'));
	}

	onOpen(): void {
		this.render();
	}

	private findCategoryForField(key: string): string | undefined {
		const byCategory = getFieldsByCategory(this.mediaType);
		for (const [catId, fields] of byCategory) {
			if (fields.some((f) => f.key === key)) return catId;
		}
		return undefined;
	}

	private updateSelectAll(categoryId: string): void {
		const fields = getFieldsByCategory(this.mediaType).get(categoryId) ?? [];
		const all = fields.every((f) => {
			if (f.advanced) return true;
			const disabled = f.personal && !this.personalOn;
			return disabled || this.selected.has(f.key);
		});
		const chk = this.catCheckboxes.get(categoryId);
		if (chk) chk.checked = all;
	}

	private toggleField(key: string): void {
		if (this.selected.has(key)) {
			this.selected.delete(key);
		} else {
			this.selected.add(key);
		}
		const cb = this.fieldCheckboxes.get(key);
		if (cb) cb.checked = this.selected.has(key);
		const cat = this.findCategoryForField(key);
		if (cat) this.updateSelectAll(cat);
	}

	private selectCategory(categoryId: string, select: boolean): void {
		const fields = getFieldsByCategory(this.mediaType).get(categoryId) ?? [];
		for (const f of fields) {
			if (f.advanced) continue;
			const disabled = f.personal && !this.personalOn;
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
	}

	private render(): void {
		this.contentEl.empty();

		const categories = getCategories(this.mediaType);
		const byCategory = getFieldsByCategory(this.mediaType);
		this.catCheckboxes.clear();
		this.fieldCheckboxes.clear();

		const container = this.contentEl.createDiv({ cls: 'babylon-field-selector' });
		const footer = this.contentEl.createDiv({ cls: 'babylon-field-pick-footer' });

		for (const cat of categories) {
			const fields = byCategory.get(cat.id) ?? [];
			if (fields.length === 0) continue;

			const details = container.createEl('details');
			details.open = true;

			const summary = details.createEl('summary');
			summary.addClass('babylon-field-summary');
			const iconSpan = summary.createSpan({ cls: 'babylon-field-cat-icon' });
			setIcon(iconSpan, cat.icon);
			summary.createSpan({ text: tr(cat.labelKey) });

			const allSelected = fields.every((f) => {
				const disabled = f.personal && !this.personalOn;
				return disabled || this.selected.has(f.key);
			});
			const chkLabel = summary.createEl('label', { cls: 'babylon-cat-select-all' });
			const chk = chkLabel.createEl('input', { attr: { type: 'checkbox' } });
			chk.checked = allSelected;
			chk.addEventListener('change', (e) => {
				e.stopPropagation();
				this.selectCategory(cat.id, chk.checked);
			});
			chkLabel.createSpan({ text: tr('field-select-all') });
			this.catCheckboxes.set(cat.id, chk);

			const grid = details.createDiv({ cls: 'babylon-field-grid' });
			for (const field of fields) {
				if (field.advanced) continue;
				const disabled = field.personal && !this.personalOn;
				const label = grid.createEl('label', { cls: 'babylon-field-item' });
				if (disabled) label.addClass('babylon-field-disabled');
				const cb = label.createEl('input', { attr: { type: 'checkbox' } });
				cb.checked = this.selected.has(field.key);
				cb.disabled = disabled;
				cb.addEventListener('change', () => this.toggleField(field.key));
				label.createSpan({ text: tr(field.labelKey) });
				this.fieldCheckboxes.set(field.key, cb);
			}
		}

		new Setting(footer)
			.addButton((b) => b.setButtonText(tr('cancel')).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(tr('preset-apply'))
					.setCta()
					.onClick(() => {
						this.onApply([...this.selected]);
						this.close();
					}),
			);
	}
}

// transient editing state for the preset currently open in the editor view
interface EditState {
	preset: MediaPreset;
	originalName: string;
	isNew: boolean;
	vmaps: Map<string, MapRow[]>;
	numberInputs: Map<string, { scaleFrom: string; scaleTo: string; round: string }>;
	expandedFormat: Set<string>;
}

/**
 * Standalone "Preset Editor" window opened from the settings. Lists all presets
 * of a media type and lets you create, select (set default), edit, duplicate and
 * delete them, as well as attach a template file to each preset. Field editing
 * happens in place, in the same window.
 */
export class PresetManagerModal extends Modal {
	private plugin: BabylonPlugin;
	private mediaType: MediaType;
	private collection: PresetCollection | null = null;
	private edit: EditState | null = null;

	constructor(plugin: BabylonPlugin, mediaType: MediaType = 'anime') {
		super(plugin.app);
		this.plugin = plugin;
		this.mediaType = mediaType;
		this.titleEl.setText(tr('preset-manager-title'));
		this.modalEl.addClass('babylon-preset-manager-modal');
	}

	private get personalOn(): boolean {
		return this.plugin.settings.anilistAuth.personalizationEnabled;
	}

	private presetPath(): string {
		return `${this.plugin.settings.templateFolder}/${makePresetPath(this.mediaType)}`;
	}

	async onOpen(): Promise<void> {
		this.collection = await loadPresets(this.plugin.app, this.presetPath());
		this.renderList();
	}

	private async persist(collection: PresetCollection): Promise<void> {
		this.collection = collection;
		await savePresets(this.plugin.app, this.presetPath(), collection);
		await this.plugin.updateAnilistProvider();
	}

	// ── list view ──────────────────────────────────────────────

	private renderList(): void {
		this.edit = null;
		this.contentEl.empty();

		const wrapper = this.contentEl.createDiv({ cls: 'babylon-preset-manager' });

		const header = wrapper.createDiv({ cls: 'babylon-preset-manager-header' });
		header.createDiv({ cls: 'babylon-preset-manager-title', text: tr('preset-manager-title') });
		header.createDiv({ cls: 'babylon-preset-manager-sub', text: tr('preset-manager-desc') });

		new Setting(wrapper)
			.setName(tr('preset-create'))
			.setDesc(tr('preset-create-desc'))
			.addButton((btn) => {
				btn.setButtonText(`${tr('preset-create')} …`);
				btn.setCta();
				btn.onClick(() => this.startCreate());
			});

		const list = wrapper.createDiv({ cls: 'babylon-preset-settings-list' });
		const presets = this.collection?.presets ?? [];
		if (presets.length === 0) {
			list.createDiv({ cls: 'babylon-preset-empty', text: tr('preset-none-found') });
		}
		for (const preset of [...presets].sort((a, b) => Number(a.isDefault) - Number(b.isDefault))) {
			this.renderListRow(list, preset);
		}
	}

	private renderListRow(container: HTMLElement, preset: MediaPreset): void {
		const row = container.createDiv({ cls: 'babylon-preset-settings-row' });

		// leading default checkbox (radio-style): only one default at a time
		const defInput = row.createEl('input', {
			cls: 'babylon-preset-default-radio',
			attr: { type: 'checkbox' },
		});
		defInput.checked = preset.isDefault;
		defInput.setAttribute('title', tr('preset-set-default'));
		defInput.addEventListener('change', () => {
			if (defInput.checked) void this.setDefault(preset);
			else defInput.checked = true;
		});

		const info = row.createDiv({ cls: 'babylon-preset-settings-info' });
		info.createSpan({ text: preset.name, cls: 'babylon-preset-settings-name' });
		const meta: string[] = [
			tr('preset-field-count', { count: preset.fields.length }),
			preset.template ? preset.template : tr('preset-no-template'),
		];
		info.createSpan({ text: meta.join(' · '), cls: 'babylon-preset-settings-count' });

		const btns = row.createDiv({ cls: 'babylon-preset-settings-btns' });
		const editBtn = btns.createEl('button', { cls: 'mod-muted', text: '' });
		setIcon(editBtn, 'pencil');
		editBtn.append(tr('preset-edit'));
		editBtn.setAttribute('title', tr('preset-edit'));
		editBtn.addEventListener('click', () => this.startEdit(preset));
		const dupBtn = btns.createEl('button', { cls: 'mod-muted', text: '' });
		setIcon(dupBtn, 'copy');
		dupBtn.append(tr('preset-duplicate'));
		dupBtn.setAttribute('title', tr('preset-duplicate'));
		dupBtn.addEventListener('click', () => void this.duplicate(preset));
		const delBtn = btns.createEl('button', { cls: 'mod-warning', text: '' });
		setIcon(delBtn, 'trash');
		delBtn.append(tr('preset-delete'));
		delBtn.setAttribute('title', tr('preset-delete'));
		delBtn.addEventListener('click', () => this.confirmDelete(preset));
	}

	private async setDefault(preset: MediaPreset): Promise<void> {
		if (!this.collection) return;
		ensureSingleDefault(this.collection, preset.name);
		await this.persist(this.collection);
		this.renderList();
	}

	private async duplicate(preset: MediaPreset): Promise<void> {
		if (!this.collection) return;
		const copyName = makeCopyName(preset.name);
		if (this.collection.presets.some((p) => p.name === copyName)) {
			new Notice(tr('preset-name-clash'));
			return;
		}
		const copy: MediaPreset = JSON.parse(JSON.stringify(preset)) as MediaPreset;
		copy.name = copyName;
		copy.isDefault = false;
		copy.fields = copy.fields.map((f) => ({ ...f, id: makeFieldId() }));
		this.collection.presets.push(copy);
		await this.persist(this.collection);
		this.renderList();
	}

	private confirmDelete(preset: MediaPreset): void {
		new ConfirmModal(
			this.app,
			tr('preset-delete'),
			tr('preset-delete-confirm', { name: preset.name }),
			() => void this.delete(preset),
		).open();
	}

	private async delete(preset: MediaPreset): Promise<void> {
		if (!this.collection) return;
		this.collection.presets = this.collection.presets.filter((p) => p.name !== preset.name);
		await this.persist(this.collection);
		new Notice(tr('preset-deleted'));
		this.renderList();
	}

	private startCreate(): void {
		const hasDefault = this.collection?.presets.some((p) => p.isDefault) ?? false;
		const preset = buildDefaultPreset(this.mediaType, '');
		if (hasDefault) preset.isDefault = false;
		this.beginEdit(preset, true);
	}

	private startEdit(preset: MediaPreset): void {
		this.beginEdit(JSON.parse(JSON.stringify(preset)) as MediaPreset, false);
	}

	private beginEdit(preset: MediaPreset, isNew: boolean): void {
		this.edit = {
			preset,
			originalName: preset.name,
			isNew,
			vmaps: new Map(),
			numberInputs: new Map(),
			expandedFormat: new Set(),
		};
		this.renderEditor();
	}

	// ── editor view ───────────────────────────────────────────

	private renderEditor(): void {
		const state = this.edit;
		if (!state) {
			this.renderList();
			return;
		}
		this.contentEl.empty();

		const wrapper = this.contentEl.createDiv({ cls: 'babylon-preset-manager' });
		const editor = wrapper.createDiv({ cls: 'babylon-preset-editor' });

		new Setting(editor).addButton((b) =>
			b.setIcon('arrow-left').setTooltip(tr('preset-back')).onClick(() => this.renderList()),
		);

		// name
		const nameSetting = new Setting(editor).setName(tr('preset-name')).setDesc('');
		const nameErrorEl = nameSetting.descEl.createDiv({ cls: 'babylon-preset-name-error hidden' });
		nameSetting.addText((text) => {
			text.setValue(state.preset.name);
			text.setPlaceholder(tr('preset-name-placeholder'));
			text.inputEl.addClass('babylon-preset-name-input');
			text.onChange((v) => {
				state.preset.name = v.trim();
				this.updateNameError(text.inputEl, nameErrorEl);
			});
		});
		this.updateNameError(
			nameSetting.controlEl.querySelector('.babylon-preset-name-input'),
			nameErrorEl,
		);

		// per-preset template file + quick create button
		const templateSetting = new Setting(editor)
			.setName(tr('preset-template'))
			.setDesc(tr('preset-template-desc'));
		addFilePicker(templateSetting, this.app, state.preset.template ?? '', (value) => {
			state.preset.template = value || undefined;
		});
		templateSetting.addExtraButton((b) => {
			b.setIcon('file-plus')
				.setTooltip(tr('preset-template-create-note'))
				.onClick(() => void this.createDraftNote());
		});

		// fields
		const fieldsHeader = editor.createDiv({ cls: 'babylon-preset-fields-header' });
		fieldsHeader.createSpan({ cls: 'babylon-preset-fields-title', text: tr('preset-fields') });
		const pickBtn = fieldsHeader.createEl('button', { cls: 'babylon-preset-pick-many' });
		setIcon(pickBtn, 'list-plus');
		pickBtn.append(tr('preset-fields-add'));
		pickBtn.setAttribute('title', tr('preset-fields-add-desc'));
		pickBtn.addEventListener('click', () => this.openQuickPick());

		const fieldsBox = editor.createDiv({ cls: 'babylon-preset-fieldsbox' });
		this.renderFields(fieldsBox, state, true);

		new Setting(editor)
			.addButton((b) =>
				b.setIcon('plus').setTooltip(tr('preset-add-field')).onClick(() => {
					this.addField();
					this.renderFields(fieldsBox, this.edit!, false);
				}),
			)
			.addButton((b) =>
				b.setButtonText(tr('preset-save')).setCta().onClick(() => void this.saveEdit()),
			)
			.addButton((b) => b.setButtonText(tr('cancel')).onClick(() => this.renderList()));
	}

	// re-render only the field list, preserving scroll (see docs/BUGLOG.md)
	private renderFields(box: HTMLElement, state: EditState, initial = false): void {
		const render = () => {
			box.empty();
			const th = box.createDiv({ cls: 'babylon-preset-th' });
			th.createSpan({ cls: 'babylon-preset-th-move' });
			th.createSpan({ cls: 'babylon-preset-th-property', text: tr('preset-column-property') });
			th.createSpan({ cls: 'babylon-preset-th-apikey', text: tr('preset-column-apikey') });
			th.createSpan({ cls: 'babylon-preset-th-type', text: tr('preset-column-type') });
			th.createSpan({ cls: 'babylon-preset-th-sync', text: tr('preset-column-sync') });
			th.createSpan({ cls: 'babylon-preset-column-actions', text: '' });

			const listEl = box.createDiv({ cls: 'babylon-preset-list' });
			const sorted = [...state.preset.fields].sort((a, b) => a.order - b.order);
			if (sorted.length === 0) {
				listEl.createDiv({ cls: 'babylon-preset-empty', text: tr('preset-no-fields') });
			}
			for (const field of sorted) {
				this.renderFieldRow(listEl, state, field);
			}
		};
		if (initial) {
			render();
			return;
		}
		preserveReRenderState(box, render, '.babylon-preset-list');
	}

	private updateNameError(
		input: HTMLElement | null,
		errorEl: HTMLElement,
	): void {
		const state = this.edit;
		if (!state || !input) return;
		const name = state.preset.name;
		const empty = name.length === 0;
		const dup = this.isDuplicateName(name);
		if (empty) {
			input.classList.add('babylon-preset-name-error-input');
			errorEl.setText(tr('preset-name-required'));
			errorEl.classList.remove('hidden');
		} else if (dup) {
			input.classList.add('babylon-preset-name-error-input');
			errorEl.setText(tr('preset-name-clash'));
			errorEl.classList.remove('hidden');
		} else {
			input.classList.remove('babylon-preset-name-error-input');
			errorEl.setText('');
			errorEl.classList.add('hidden');
		}
	}

	private isDuplicateName(name: string): boolean {
		if (!this.collection || !this.edit) return false;
		return this.collection.presets.some(
			(p) => p.name === name && p.name !== this.edit!.originalName,
		);
	}

	private openQuickPick(): void {
		const state = this.edit;
		if (!state) return;
		const currentKeys = state.preset.fields.map((f) => f.apiKey);
		new FieldQuickPickModal(this.app, this.mediaType, currentKeys, this.personalOn, (selected) => {
			this.applyFieldSelection(selected);
		}).open();
	}

	// align the preset's fields with the selection from the quick picker
	private applyFieldSelection(selected: string[]): void {
		const state = this.edit;
		if (!state) return;
		const selectedSet = new Set(selected);
		const defs = new Map(getFields(this.mediaType).map((f) => [f.key, f]));

		const kept = state.preset.fields.filter((f) => selectedSet.has(f.apiKey));
		const existingKeys = new Set(kept.map((f) => f.apiKey));
		const added: PresetField[] = [];
		for (const key of selected) {
			if (existingKeys.has(key)) continue;
			const def = defs.get(key);
			added.push({
				id: makeFieldId(),
				apiKey: key,
				property: def ? def.key : key,
				type: def ? def.type : 'string',
				order: kept.length + added.length,
				sync: def ? def.personal && this.personalOn : false,
			});
		}
		state.preset.fields = [...kept, ...added].map((f, i) => ({ ...f, order: i }));

		const box = this.contentEl.querySelector('.babylon-preset-fieldsbox');
		if (box) this.renderFields(box as HTMLElement, state);
	}

	private confirmDeleteEdit(): void {
		const state = this.edit;
		if (!state) return;
		// a preset that was never saved has no row to delete - just back out
		const exists = this.collection?.presets.some((p) => p.name === state.originalName) ?? false;
		if (!exists) {
			this.renderList();
			return;
		}
		new ConfirmModal(
			this.app,
			tr('preset-delete'),
			tr('preset-delete-confirm', { name: state.preset.name }),
			() => void this.deleteEdit(),
		).open();
	}

	private async deleteEdit(): Promise<void> {
		const state = this.edit;
		if (!state) return;
		if (this.collection) {
			this.collection.presets = this.collection.presets.filter((p) => p.name !== state.originalName);
			await this.persist(this.collection);
		}
		new Notice(tr('preset-deleted'));
		this.renderList();
	}

	private async saveEdit(): Promise<void> {
		const state = this.edit;
		if (!state) return;
		const err = this.validate(state);
		if (err) {
			new Notice(err);
			return;
		}

		this.normalize(state.preset);

		const collection = this.collection ?? {
			version: PRESET_COLLECTION_VERSION,
			mediaType: this.mediaType,
			presets: [],
		};
		if (!this.collection) this.collection = collection;

		if (state.isNew) {
			collection.presets.push(state.preset);
		} else {
			const existing = collection.presets.find((p) => p.name === state.originalName);
			if (existing) {
				Object.assign(existing, state.preset);
			} else {
				collection.presets.push(state.preset);
			}
		}
		ensureSingleDefault(collection, state.preset.name);

		await this.persist(collection);
		new Notice(tr('preset-saved'));
		this.renderList();
	}

	private validate(state: EditState): string | null {
		if (!state.preset.name.trim()) return tr('preset-name-required');
		if (this.isDuplicateName(state.preset.name)) return tr('preset-name-clash');
		const seen = new Set<string>();
		for (const f of state.preset.fields) {
			const p = f.property.trim();
			if (!p) return tr('preset-field-property-empty');
			if (seen.has(p)) return tr('preset-field-duplicate-property', { name: p });
			seen.add(p);
			if (!f.apiKey.trim()) return tr('preset-field-apikey-empty');
		}
		return null;
	}

	private normalize(preset: MediaPreset): void {
		const fields = [...preset.fields].sort((a, b) => a.order - b.order);
		fields.forEach((f, i) => {
			f.order = i;
			if (f.format && Object.keys(f.format).length === 0) {
				delete f.format;
			}
		});
		const state = this.edit!;
		for (const f of fields) {
			const rows = state.vmaps.get(f.id);
			if (rows && rows.some((r) => r.from.trim())) {
				const valueMap: Record<string, string> = {};
				for (const r of rows) {
					if (r.from.trim()) valueMap[r.from.trim()] = r.to.trim();
				}
				f.format = f.format ?? {};
				f.format.valueMap = valueMap;
			} else if (f.format?.valueMap) {
				delete f.format.valueMap;
			}

			const num = state.numberInputs.get(f.id);
			if (num) {
				const scaleFrom = num.scaleFrom.trim() !== '' ? Number(num.scaleFrom) : undefined;
				const scaleTo = num.scaleTo.trim() !== '' ? Number(num.scaleTo) : undefined;
				const round = num.round.trim() !== '' ? Number(num.round) : undefined;
				if (scaleFrom !== undefined || scaleTo !== undefined || round !== undefined) {
					f.format = f.format ?? {};
					f.format.number = {};
					if (scaleFrom !== undefined && !isNaN(scaleFrom)) f.format.number.scaleFrom = scaleFrom;
					if (scaleTo !== undefined && !isNaN(scaleTo)) f.format.number.scaleTo = scaleTo;
					if (round !== undefined && !isNaN(round)) f.format.number.round = round;
				} else if (f.format?.number) {
					delete f.format.number;
				}
			}
		}
	}

	private addField(): void {
		const state = this.edit;
		if (!state) return;
		const field: PresetField = {
			id: makeFieldId(),
			apiKey: '',
			property: '',
			type: 'string',
			order: state.preset.fields.length,
			sync: false,
		};
		state.preset.fields.push(field);
		state.expandedFormat.add(field.id);
	}

	private removeField(id: string): void {
		const state = this.edit;
		if (!state) return;
		state.preset.fields = state.preset.fields.filter((f) => f.id !== id);
		state.vmaps.delete(id);
		state.numberInputs.delete(id);
		state.expandedFormat.delete(id);
		const box = this.contentEl.querySelector('.babylon-preset-fieldsbox');
		if (box) this.renderFields(box as HTMLElement, state);
	}

	private moveField(id: string, dir: -1 | 1): void {
		const state = this.edit;
		if (!state) return;
		const fields = [...state.preset.fields].sort((a, b) => a.order - b.order);
		const idx = fields.findIndex((f) => f.id === id);
		if (idx === -1) return;
		const target = idx + dir;
		if (target < 0 || target >= fields.length) return;
		[fields[idx], fields[target]] = [fields[target]!, fields[idx]!];
		fields.forEach((f, i) => {
			f.order = i;
		});
		const box = this.contentEl.querySelector('.babylon-preset-fieldsbox');
		if (box) this.renderFields(box as HTMLElement, state);
	}

	private renderFieldRow(container: HTMLElement, state: EditState, field: PresetField): void {
		const row = container.createDiv({ cls: 'babylon-preset-row' });

		const move = row.createDiv({ cls: 'babylon-preset-move' });
		const upBtn = move.createEl('button', { cls: 'babylon-preset-move-btn' });
		setIcon(upBtn, 'chevron-up');
		upBtn.setAttribute('aria-label', tr('preset-move-up'));
		upBtn.addEventListener('click', () => this.moveField(field.id, -1));
		const downBtn = move.createEl('button', { cls: 'babylon-preset-move-btn' });
		setIcon(downBtn, 'chevron-down');
		downBtn.setAttribute('aria-label', tr('preset-move-down'));
		downBtn.addEventListener('click', () => this.moveField(field.id, 1));

		const prop = row.createEl('input', {
			cls: 'babylon-preset-property',
			attr: { type: 'text', placeholder: tr('preset-property-placeholder') },
		});
		prop.value = field.property;
		prop.setAttribute('aria-label', tr('preset-property'));
		prop.addEventListener('input', () => {
			field.property = prop.value.trim();
		});

		const apiBox = row.createDiv({ cls: 'babylon-preset-apikey-box' });
		const api = apiBox.createEl('input', {
			cls: 'babylon-preset-apikey',
			attr: { type: 'text', placeholder: tr('preset-apikey-placeholder') },
		});
		api.value = field.apiKey;
		api.setAttribute('aria-label', tr('preset-apikey'));
		api.addEventListener('input', () => {
			field.apiKey = api.value.trim();
		});
		const pickBtn = apiBox.createEl('button', { cls: 'babylon-preset-pick' });
		setIcon(pickBtn, 'search');
		pickBtn.setAttribute('aria-label', tr('preset-pick-field'));
		pickBtn.setAttribute('title', tr('preset-pick-field'));
		pickBtn.addEventListener('click', () => {
			const items = getFields(this.mediaType).map((f) => f.key);
			items.push('advancedScores');
			new FieldSuggestModal(this.app, items, (key) => {
				field.apiKey = key;
				const box = this.contentEl.querySelector('.babylon-preset-fieldsbox');
				if (box) this.renderFields(box as HTMLElement, state);
			}).open();
		});

		const typeSel = row.createEl('select', { cls: 'babylon-preset-type' });
		typeSel.setAttribute('aria-label', tr('preset-type'));
		for (const t of FIELD_TYPES) {
			const opt = typeSel.createEl('option', { value: t, text: t });
			if (t === field.type) opt.selected = true;
		}
		typeSel.addEventListener('change', () => {
			field.type = typeSel.value as PresetFieldType;
			const box = this.contentEl.querySelector('.babylon-preset-fieldsbox');
			if (box) this.renderFields(box as HTMLElement, state);
		});

		const syncLabel = row.createEl('label', { cls: 'babylon-preset-sync' });
		syncLabel.createSpan({ text: tr('preset-sync') });
		const sync = syncLabel.createEl('input', { attr: { type: 'checkbox' } });
		sync.checked = field.sync;
		sync.disabled = !this.personalOn;
		syncLabel.setAttribute('title', tr('preset-sync-desc'));
		if (!this.personalOn) syncLabel.addClass('babylon-preset-sync-disabled');
		sync.addEventListener('change', () => {
			field.sync = sync.checked;
			const box = this.contentEl.querySelector('.babylon-preset-fieldsbox');
			if (box) this.renderFields(box as HTMLElement, state);
		});

		const actions = row.createDiv({ cls: 'babylon-preset-column-actions' });
		const expandBtn = actions.createEl('button', { cls: 'babylon-preset-expand' });
		const isExpanded = state.expandedFormat.has(field.id);
		setIcon(expandBtn, isExpanded ? 'chevron-down' : 'chevron-right');
		expandBtn.setAttribute('aria-label', tr('preset-format'));
		expandBtn.setAttribute('title', tr('preset-format'));
		expandBtn.addEventListener('click', () => {
			if (isExpanded) {
				state.expandedFormat.delete(field.id);
			} else {
				state.expandedFormat.add(field.id);
			}
			const box = this.contentEl.querySelector('.babylon-preset-fieldsbox');
			if (box) this.renderFields(box as HTMLElement, state);
		});

		const removeBtn = actions.createEl('button', { cls: 'babylon-preset-remove' });
		setIcon(removeBtn, 'x');
		removeBtn.setAttribute('aria-label', tr('preset-remove-field'));
		removeBtn.setAttribute('title', tr('preset-remove-field'));
		removeBtn.addEventListener('click', () => this.removeField(field.id));

		if (isExpanded) {
			this.renderFormatBlock(row, state, field);
		}
	}

	private renderFormatBlock(container: HTMLElement, state: EditState, field: PresetField): void {
		const fmt = container.createDiv({ cls: 'babylon-preset-format' });
		const format = field.format ?? (field.format = {});
		const sub = fmt.createDiv({ cls: 'babylon-preset-format-grid' });

		const caseSetting = new Setting(sub).setName(tr('preset-format-case'));
		caseSetting.addDropdown((dropdown) => {
			for (const c of CASE_OPTIONS) {
				dropdown.addOption(c, c === 'none' ? tr('preset-none') : c);
			}
			dropdown.setValue(format.case ?? 'none');
			dropdown.onChange((v) => {
				const val = v as FieldCase;
				format.case = val === 'none' ? undefined : val;
			});
		});

		const mapSetting = new Setting(sub)
			.setName(tr('preset-format-value-map'))
			.setDesc(tr('preset-format-value-map-desc'));
		const mapEl = mapSetting.controlEl.createDiv({ cls: 'babylon-preset-vmap' });
		const rows = state.vmaps.get(field.id) ?? [];
		if (state.vmaps.get(field.id) === undefined) {
			state.vmaps.set(
				field.id,
				Object.entries(format.valueMap ?? {}).map(([from, to]) => ({ from, to })),
			);
		}
		for (let i = 0; i < rows.length; i++) {
			this.renderVmapRow(mapEl, state, field, i);
		}
		mapEl.createEl('button', {
			cls: 'babylon-preset-vmap-add',
			text: '+ ' + tr('preset-format-value-map-add'),
		}).addEventListener('click', () => {
			state.vmaps.get(field.id)!.push({ from: '', to: '' });
			this.renderEditor();
		});

		const dateSetting = new Setting(sub).setName(tr('preset-format-date'));
		dateSetting.addDropdown((dropdown) => {
			for (const d of DATE_OPTIONS) {
				dropdown.addOption(d || 'none', d || tr('preset-none'));
			}
			dropdown.setValue(format.dateFormat ?? '');
			dropdown.onChange((v) => {
				format.dateFormat = v === 'none' || v === '' ? undefined : v as FieldFormat['dateFormat'];
			});
		});

		const numSetting = new Setting(sub).setName(tr('preset-format-number'));
		const numEl = numSetting.controlEl.createDiv({ cls: 'babylon-preset-num' });
		const num = state.numberInputs.get(field.id) ?? { scaleFrom: '', scaleTo: '', round: '' };
		if (state.numberInputs.get(field.id) === undefined) {
			state.numberInputs.set(field.id, {
				scaleFrom: format.number?.scaleFrom !== undefined ? String(format.number.scaleFrom) : '',
				scaleTo: format.number?.scaleTo !== undefined ? String(format.number.scaleTo) : '',
				round: format.number?.round !== undefined ? String(format.number.round) : '',
			});
		}
		for (const [key, placeholder] of [
			['scaleFrom', tr('preset-number-scale-from')],
			['scaleTo', tr('preset-number-scale-to')],
			['round', tr('preset-number-round')],
		] as const) {
			const input = numEl.createEl('input', {
				cls: 'babylon-preset-num-input',
				attr: { type: 'number', placeholder },
			});
			input.value = num[key];
			input.addEventListener('input', () => {
				num[key] = input.value;
			});
		}
	}

	private renderVmapRow(container: HTMLElement, state: EditState, field: PresetField, idx: number): void {
		const rows = state.vmaps.get(field.id)!;
		const row = container.createDiv({ cls: 'babylon-preset-vmap-row' });
		const from = row.createEl('input', { attr: { type: 'text', placeholder: tr('preset-vmap-from') } });
		from.value = rows[idx]!.from;
		from.addEventListener('input', () => {
			rows[idx]!.from = from.value;
		});
		row.createSpan({ text: '→', cls: 'babylon-preset-vmap-arrow' });
		const to = row.createEl('input', { attr: { type: 'text', placeholder: tr('preset-vmap-to') } });
		to.value = rows[idx]!.to;
		to.addEventListener('input', () => {
			rows[idx]!.to = to.value;
		});
		const removeBtn = row.createEl('button', { cls: 'babylon-preset-vmap-remove' });
		setIcon(removeBtn, 'x');
		removeBtn.addEventListener('click', () => {
			rows.splice(idx, 1);
			this.renderEditor();
		});
	}

	// quick create a draft note from this preset's template and open it
	private async createDraftNote(): Promise<void> {
		const state = this.edit;
		if (!state) return;
		const tpl = state.preset.template;
		if (!tpl) {
			new Notice(tr('preset-template-required'));
			return;
		}
		const tfile = this.app.vault.getAbstractFileByPath(tpl);
		if (!(tfile instanceof TFile)) {
			new Notice(tr('preset-template-missing'));
			return;
		}
		const content = await this.app.vault.read(tfile);
		const dir = tfile.parent?.path ?? '';
		const strip = tfile.basename.replace(/[\\/:*?"<>|]/g, '-');
		const baseName = `${strip} - draft`;
		let fileName = `${baseName}.md`;
		if (this.app.vault.getAbstractFileByPath(`${dir}/${fileName}`)) {
			let i = 2;
			while (this.app.vault.getAbstractFileByPath(`${dir}/${baseName} (${i}).md`)) i++;
			fileName = `${baseName} (${i}).md`;
		}
		const file = await this.app.vault.create(`${dir}/${fileName}`.replace(/^\//, ''), content);
		const leaf = this.app.workspace.getLeaf();
		if (leaf) await leaf.openFile(file);
		new Notice(tr('preset-draft-created'));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
