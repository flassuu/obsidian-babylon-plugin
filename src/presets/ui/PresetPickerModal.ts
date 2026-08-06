import { App, FuzzySuggestModal } from 'obsidian';
import type { MediaPreset } from '../types';

// lets the user pick which preset to use when creating a note.
// promise-based: call openAndGet() and await the selection.
export class PresetPickerModal extends FuzzySuggestModal<MediaPreset> {
	private presets: MediaPreset[];
	private resolve: ((p: MediaPreset | null) => void) | null = null;
	private settled = false;

	constructor(app: App, presets: MediaPreset[]) {
		super(app);
		this.presets = presets;
		this.setPlaceholder('Choose a preset for this note');
	}

	openAndGet(): Promise<MediaPreset | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	getItems(): MediaPreset[] {
		return this.presets;
	}

	getItemText(item: MediaPreset): string {
		return item.name;
	}

	onChooseItem(item: MediaPreset): void {
		this.settle(item);
	}

	onClose(): void {
		this.settle(null);
		this.contentEl.empty();
	}

	private settle(p: MediaPreset | null): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve?.(p);
	}
}
