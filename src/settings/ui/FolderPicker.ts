import { App, FuzzySuggestModal, Setting, SearchComponent, TFolder } from 'obsidian';

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
