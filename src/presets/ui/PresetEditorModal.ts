import { App, FuzzySuggestModal, Modal, Notice, Setting, setIcon } from 'obsidian';
import type BabylonPlugin from '../../main';
import type { MediaType } from '../../types';
import { getFields } from '../../fields/FieldRegistry';
import type { FieldCase, FieldFormat, MediaPreset, PresetField, PresetFieldType } from '../types';
import { makeFieldId, PRESET_COLLECTION_VERSION } from '../types';
import { loadPresets, savePresets, makePresetPath, ensureSingleDefault } from '../PresetStore';
import { makeCopyName } from '../PresetFieldFactory';
import { tr } from '../../i18n';
import { ConfirmModal } from '../../ui/modals/ConfirmModal';

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

export class PresetEditorModal extends Modal {
	private plugin: BabylonPlugin;
	private mediaType: MediaType;
	private preset: MediaPreset;
	private originalName: string;

	// transient UI state, keyed by field id — not part of the saved JSON
	private vmaps = new Map<string, MapRow[]>();
	private numberInputs = new Map<string, { scaleFrom: string; scaleTo: string; round: string }>();
	private expandedFormat = new Set<string>();

	constructor(plugin: BabylonPlugin, mediaType: MediaType, preset: MediaPreset) {
		super(plugin.app);
		this.plugin = plugin;
		this.mediaType = mediaType;
		this.preset = JSON.parse(JSON.stringify(preset)) as MediaPreset;
		this.originalName = this.preset.name;
		this.titleEl.setText(`${tr('preset-editor-title')}: ${this.preset.name}`);
	}

	onOpen(): void {
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.renderHeader(contentEl);
		this.renderToolbar(contentEl);
		this.renderFieldList(contentEl);
		this.renderActions(contentEl);
	}

	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv({ cls: 'babylon-preset-header' });

		new Setting(header)
			.setName(tr('preset-name'))
			.addText((text) => {
				text.setValue(this.preset.name);
				text.onChange((v) => {
					this.preset.name = v.trim();
				});
			});

		new Setting(header)
			.setName(tr('preset-default'))
			.setDesc(tr('preset-default-desc'))
			.addToggle((toggle) => {
				toggle.setValue(this.preset.isDefault);
				toggle.onChange((v) => {
					this.preset.isDefault = v;
				});
			});
	}

	private renderToolbar(container: HTMLElement): void {
		new Setting(container)
			.addButton((b) =>
				b.setIcon('plus')
					.setTooltip(tr('preset-add-field'))
					.onClick(() => this.addField()),
			)
			.addButton((b) =>
				b.setButtonText(tr('preset-duplicate'))
					.onClick(() => void this.duplicate()),
			)
			.addButton((b) =>
				b.setButtonText(tr('preset-delete'))
					.onClick(() => void this.removePreset()),
			);
	}

	private renderFieldList(container: HTMLElement): void {
		const list = container.createDiv({ cls: 'babylon-preset-list' });
		const sorted = [...this.preset.fields].sort((a, b) => a.order - b.order);
		for (const field of sorted) {
			this.renderFieldRow(list, field);
		}
		if (this.preset.fields.length === 0) {
			list.createEl('p', {
				text: tr('preset-no-fields'),
				cls: 'babylon-preset-empty',
			});
		}
	}

	private renderActions(container: HTMLElement): void {
		new Setting(container)
			.addButton((b) =>
				b.setButtonText(tr('preset-save'))
					.setCta()
					.onClick(() => void this.save()),
			)
			.addButton((b) =>
				b.setButtonText(tr('cancel'))
					.onClick(() => this.close()),
			);
	}

	private renderFieldRow(container: HTMLElement, field: PresetField): void {
		const row = container.createDiv({ cls: 'babylon-preset-row' });

		// reorder controls
		const move = row.createDiv({ cls: 'babylon-preset-move' });
		const upBtn = move.createEl('button', { cls: 'babylon-preset-move-btn' });
		setIcon(upBtn, 'chevron-up');
		upBtn.addEventListener('click', () => this.moveField(field.id, -1));
		const downBtn = move.createEl('button', { cls: 'babylon-preset-move-btn' });
		setIcon(downBtn, 'chevron-down');
		downBtn.addEventListener('click', () => this.moveField(field.id, 1));

		// property name (frontmatter key == template alias)
		const prop = row.createEl('input', {
			cls: 'babylon-preset-property',
			attr: { type: 'text', placeholder: tr('preset-property-placeholder') },
		});
		prop.value = field.property;
		prop.addEventListener('input', () => {
			field.property = prop.value.trim();
		});

		// api key (data source) + picker
		const api = row.createEl('input', {
			cls: 'babylon-preset-apikey',
			attr: { type: 'text', placeholder: tr('preset-apikey-placeholder') },
		});
		api.value = field.apiKey;
		api.addEventListener('input', () => {
			field.apiKey = api.value.trim();
		});
		const pickBtn = row.createEl('button', { cls: 'babylon-preset-pick' });
		setIcon(pickBtn, 'search');
		pickBtn.setAttribute('aria-label', tr('preset-pick-field'));
		pickBtn.addEventListener('click', () => {
			const items = getFields(this.mediaType).map((f) => f.key);
			items.push('advancedScores');
			new FieldSuggestModal(this.app, items, (key) => {
				field.apiKey = key;
				this.render();
			}).open();
		});

		// sync toggle
		const syncLabel = row.createEl('label', { cls: 'babylon-preset-sync' });
		syncLabel.createSpan({ text: tr('preset-sync') });
		const sync = syncLabel.createEl('input', { attr: { type: 'checkbox' } });
		sync.checked = field.sync;
		sync.addEventListener('change', () => {
			field.sync = sync.checked;
		});

		// type select
		const typeSel = row.createEl('select', { cls: 'babylon-preset-type' });
		for (const t of FIELD_TYPES) {
			const opt = typeSel.createEl('option', { value: t, text: t });
			if (t === field.type) opt.selected = true;
		}
		typeSel.addEventListener('change', () => {
			field.type = typeSel.value as PresetFieldType;
		});

		// format expander
		const expandBtn = row.createEl('button', { cls: 'babylon-preset-expand' });
		const isExpanded = this.expandedFormat.has(field.id);
		setIcon(expandBtn, isExpanded ? 'chevron-down' : 'chevron-right');
		expandBtn.setAttribute('aria-label', tr('preset-format'));
		expandBtn.addEventListener('click', () => {
			if (isExpanded) {
				this.expandedFormat.delete(field.id);
			} else {
				this.expandedFormat.add(field.id);
			}
			this.render();
		});

		// remove
		const removeBtn = row.createEl('button', { cls: 'babylon-preset-remove' });
		setIcon(removeBtn, 'x');
		removeBtn.setAttribute('aria-label', tr('preset-remove-field'));
		removeBtn.addEventListener('click', () => this.removeField(field.id));

		if (isExpanded) {
			this.renderFormatBlock(row, field);
		}
	}

	private renderFormatBlock(container: HTMLElement, field: PresetField): void {
		const fmt = container.createDiv({ cls: 'babylon-preset-format' });
		const format = field.format ?? (field.format = {});

		// case
		new Setting(fmt)
			.setName(tr('preset-format-case'))
			.addDropdown((dropdown) => {
				for (const c of CASE_OPTIONS) {
					dropdown.addOption(c, c === 'none' ? tr('preset-none') : c);
				}
				dropdown.setValue(format.case ?? 'none');
				dropdown.onChange((v) => {
					const val = v as FieldCase;
					format.case = val === 'none' ? undefined : val;
				});
			});

		// value map
		const rows = this.vmaps.get(field.id) ?? [];
		if (this.vmaps.get(field.id) === undefined) {
			const init = Object.entries(format.valueMap ?? {}).map(([from, to]) => ({ from, to }));
			this.vmaps.set(field.id, init);
		}
		const mapSetting = new Setting(fmt)
			.setName(tr('preset-format-value-map'))
			.setDesc(tr('preset-format-value-map-desc'));
		const mapEl = mapSetting.controlEl.createDiv({ cls: 'babylon-preset-vmap' });
		for (let i = 0; i < rows.length; i++) {
			this.renderVmapRow(mapEl, field, i);
		}
		mapEl.createEl('button', {
			cls: 'babylon-preset-vmap-add',
			text: '+ ' + tr('preset-format-value-map-add'),
		}).addEventListener('click', () => {
			this.vmaps.get(field.id)!.push({ from: '', to: '' });
			this.render();
		});

		// date format
		new Setting(fmt)
			.setName(tr('preset-format-date'))
			.addDropdown((dropdown) => {
				for (const d of DATE_OPTIONS) {
					dropdown.addOption(d || 'none', d || tr('preset-none'));
				}
				dropdown.setValue(format.dateFormat ?? '');
				dropdown.onChange((v) => {
					format.dateFormat = v === 'none' || v === '' ? undefined : v as FieldFormat['dateFormat'];
				});
			});

		// number scale
		const num = this.numberInputs.get(field.id) ?? { scaleFrom: '', scaleTo: '', round: '' };
		if (this.numberInputs.get(field.id) === undefined) {
			this.numberInputs.set(field.id, {
				scaleFrom: format.number?.scaleFrom !== undefined ? String(format.number.scaleFrom) : '',
				scaleTo: format.number?.scaleTo !== undefined ? String(format.number.scaleTo) : '',
				round: format.number?.round !== undefined ? String(format.number.round) : '',
			});
		}
		const numSetting = new Setting(fmt).setName(tr('preset-format-number'));
		const numEl = numSetting.controlEl.createDiv({ cls: 'babylon-preset-num' });
		const fromInput = numEl.createEl('input', {
			cls: 'babylon-preset-num-input',
			attr: { type: 'number', placeholder: tr('preset-number-scale-from') },
		});
		fromInput.value = num.scaleFrom;
		fromInput.addEventListener('input', () => {
			num.scaleFrom = fromInput.value;
		});
		const toInput = numEl.createEl('input', {
			cls: 'babylon-preset-num-input',
			attr: { type: 'number', placeholder: tr('preset-number-scale-to') },
		});
		toInput.value = num.scaleTo;
		toInput.addEventListener('input', () => {
			num.scaleTo = toInput.value;
		});
		const roundInput = numEl.createEl('input', {
			cls: 'babylon-preset-num-input',
			attr: { type: 'number', placeholder: tr('preset-number-round') },
		});
		roundInput.value = num.round;
		roundInput.addEventListener('input', () => {
			num.round = roundInput.value;
		});
	}

	private renderVmapRow(container: HTMLElement, field: PresetField, idx: number): void {
		const rows = this.vmaps.get(field.id)!;
		const row = container.createDiv({ cls: 'babylon-preset-vmap-row' });
		const from = row.createEl('input', {
			attr: { type: 'text', placeholder: tr('preset-vmap-from') },
		});
		from.value = rows[idx]!.from;
		from.addEventListener('input', () => {
			rows[idx]!.from = from.value;
		});
		const arrow = row.createSpan({ text: '→', cls: 'babylon-preset-vmap-arrow' });
		void arrow;
		const to = row.createEl('input', {
			attr: { type: 'text', placeholder: tr('preset-vmap-to') },
		});
		to.value = rows[idx]!.to;
		to.addEventListener('input', () => {
			rows[idx]!.to = to.value;
		});
		const removeBtn = row.createEl('button', { cls: 'babylon-preset-vmap-remove' });
		setIcon(removeBtn, 'x');
		removeBtn.addEventListener('click', () => {
			rows.splice(idx, 1);
			this.render();
		});
	}

	private addField(): void {
		const field: PresetField = {
			id: makeFieldId(),
			apiKey: '',
			property: '',
			type: 'string',
			order: this.preset.fields.length,
			sync: false,
		};
		this.preset.fields.push(field);
		this.expandedFormat.add(field.id);
		this.render();
	}

	private removeField(id: string): void {
		this.preset.fields = this.preset.fields.filter((f) => f.id !== id);
		this.vmaps.delete(id);
		this.numberInputs.delete(id);
		this.expandedFormat.delete(id);
		this.render();
	}

	private moveField(id: string, dir: -1 | 1): void {
		const fields = [...this.preset.fields].sort((a, b) => a.order - b.order);
		const idx = fields.findIndex((f) => f.id === id);
		if (idx === -1) return;
		const target = idx + dir;
		if (target < 0 || target >= fields.length) return;
		[fields[idx], fields[target]] = [fields[target]!, fields[idx]!];
		fields.forEach((f, i) => {
			f.order = i;
		});
		this.render();
	}

	private async duplicate(): Promise<void> {
		const copyName = makeCopyName(this.preset.name);
		const copy: MediaPreset = JSON.parse(JSON.stringify(this.preset)) as MediaPreset;
		copy.name = copyName;
		copy.isDefault = false;
		copy.fields = copy.fields.map((f) => ({ ...f, id: makeFieldId() }));

		const path = `${this.plugin.settings.templateFolder}/${makePresetPath(this.mediaType)}`;
		const collection = await loadPresets(this.plugin.app, path);
		if (collection && collection.presets.some((p) => p.name === copyName)) {
			new Notice(tr('preset-name-clash'));
			return;
		}
		if (!collection) {
			await savePresets(this.plugin.app, path, {
				version: PRESET_COLLECTION_VERSION,
				mediaType: this.mediaType,
				presets: [copy],
			});
		} else {
			collection.presets.push(copy);
			await savePresets(this.plugin.app, path, collection);
		}

		this.originalName = copyName;
		this.preset = copy;
		this.vmaps.clear();
		this.numberInputs.clear();
		this.titleEl.setText(`${tr('preset-editor-title')}: ${copyName}`);
		new Notice(tr('preset-copied'));
		this.render();
	}

	private removePreset(): void {
		new ConfirmModal(
			this.app,
			tr('preset-delete'),
			tr('preset-delete-confirm', { name: this.preset.name }),
			() => {
				void (async () => {
					const path = `${this.plugin.settings.templateFolder}/${makePresetPath(this.mediaType)}`;
					const collection = await loadPresets(this.plugin.app, path);
					if (!collection) return;
					collection.presets = collection.presets.filter((p) => p.name !== this.originalName);
					await savePresets(this.plugin.app, path, collection);
					new Notice(tr('preset-deleted'));
					this.close();
					this.plugin.settingsTab?.display();
					void this.plugin.updateAnilistProvider();
				})();
			},
		).open();
	}

	private validate(): string | null {
		const seen = new Set<string>();
		for (const f of this.preset.fields) {
			const p = f.property.trim();
			if (!p) return tr('preset-field-property-empty');
			if (seen.has(p)) return tr('preset-field-duplicate-property', { name: p });
			seen.add(p);
			if (!f.apiKey.trim()) return tr('preset-field-apikey-empty');
		}
		if (!this.preset.name.trim()) return tr('preset-name-required');
		return null;
	}

	private async save(): Promise<void> {
		const err = this.validate();
		if (err) {
			new Notice(err);
			return;
		}

		// normalize orders and rebuild format flags from the transient UI state
		const fields = [...this.preset.fields].sort((a, b) => a.order - b.order);
		fields.forEach((f, i) => {
			f.order = i;
			if (f.format && Object.keys(f.format).length === 0) {
				delete f.format;
			}
		});
		for (const f of fields) {
			const rows = this.vmaps.get(f.id);
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

			const num = this.numberInputs.get(f.id);
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

		const path = `${this.plugin.settings.templateFolder}/${makePresetPath(this.mediaType)}`;
		const collection = await loadPresets(this.plugin.app, path);
		if (!collection) {
			await savePresets(this.plugin.app, path, {
				version: PRESET_COLLECTION_VERSION,
				mediaType: this.mediaType,
				presets: [this.preset],
			});
		} else {
			const other = collection.presets.filter((p) => p.name !== this.originalName);
			if (other.some((p) => p.name === this.preset.name)) {
				new Notice(tr('preset-name-clash'));
				return;
			}
			const idx = collection.presets.findIndex((p) => p.name === this.originalName);
			if (idx !== -1) {
				collection.presets[idx] = this.preset;
			} else {
				collection.presets.push(this.preset);
			}
			ensureSingleDefault(collection, this.preset.name);
			await savePresets(this.plugin.app, path, collection);
		}

		new Notice(tr('preset-saved'));
		this.close();
		this.plugin.settingsTab?.display();
		void this.plugin.updateAnilistProvider();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
