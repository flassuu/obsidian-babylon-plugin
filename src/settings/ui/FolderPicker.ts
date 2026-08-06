import { App, FuzzySuggestModal, Setting, SearchComponent, TFolder, setIcon } from 'obsidian';

class FolderSuggestModal extends FuzzySuggestModal<string> {
	private onSelect: (path: string) => void;

	constructor(app: App, onSelect: (path: string) => void) {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder('Choose a folder...');
	}

	getItems(): string[] {
		return this.app.vault.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder)
			.map((f) => f.path);
	}

	getItemText(item: string): string {
		return item;
	}

	onChooseItem(item: string): void {
		this.onSelect(item);
	}
}

export function addFolderPicker(
	setting: Setting,
	app: App,
	currentValue: string,
	onChange: (value: string) => void,
): void {
	let searchCmp: SearchComponent | null = null;

	setting.addSearch((search) => {
		searchCmp = search;
		search.setValue(currentValue);
		search.onChange(onChange);
		search.inputEl.addClass('babylon-folder-input');
	});

	setting.addButton((btn) => {
		btn.setIcon('folder-open');
		btn.setTooltip('Browse folders');
		btn.onClick(() => {
			const modal = new FolderSuggestModal(app, (path) => {
				onChange(path);
				searchCmp?.setValue(path);
			});
			modal.open();
		});
	});

	setting.addButton((btn) => {
		btn.setIcon('x');
		btn.setTooltip('Clear');
		btn.onClick(() => {
			onChange('');
			searchCmp?.setValue('');
		});
	});
}

// Folder picker for a collapsible group header (no surrounding Setting row).
export function addFolderPickerToControl(
	containerEl: HTMLElement,
	app: App,
	currentValue: string,
	onChange: (value: string) => void,
): void {
	const searchCmp = new SearchComponent(containerEl);
	searchCmp.setValue(currentValue);
	searchCmp.onChange(onChange);
	searchCmp.inputEl.addClass('babylon-folder-input');

	const browseBtn = containerEl.createEl('button', { cls: 'clickable-icon' });
	setIcon(browseBtn, 'folder-open');
	browseBtn.setAttribute('aria-label', 'Browse folders');
	browseBtn.addEventListener('click', () => {
		const modal = new FolderSuggestModal(app, (path) => {
			onChange(path);
			searchCmp.setValue(path);
		});
		modal.open();
	});

	const clearBtn = containerEl.createEl('button', { cls: 'clickable-icon' });
	setIcon(clearBtn, 'x');
	clearBtn.setAttribute('aria-label', 'Clear');
	clearBtn.addEventListener('click', () => {
		onChange('');
		searchCmp.setValue('');
	});
}
