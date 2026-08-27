import { App, AbstractInputSuggest, Setting, TextComponent, TFolder } from 'obsidian';
import { tr } from '../../i18n';

// Obsidian's own folder/file pickers (e.g. "Template folder location" in the
// core Templates settings) are built on the public AbstractInputSuggest class,
// which renders an inline suggestion dropdown when you type or focus an input.
// We do the same here: two concrete suggester types — folders and markdown
// files — that behave identically to the native Obsidian picker.
abstract class BaseSuggest extends AbstractInputSuggest<string> {
	private input: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.input = inputEl;
	}

	protected abstract getSuggestions(query: string): string[];

	renderSuggestion(path: string, el: HTMLElement): void {
		el.createDiv({ text: path });
	}

	selectSuggestion(path: string): void {
		this.setValue(path);
		// notify the text component so its onChange (which persists the value) runs
		this.input.dispatchEvent(new Event('input', { bubbles: true }));
		this.close();
	}
}

export class FolderSuggest extends BaseSuggest {
	protected getSuggestions(query: string): string[] {
		const q = query.trim().toLowerCase();
		const folders = this.app.vault.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder)
			.map((f) => f.path);
		return q ? folders.filter((p) => p.toLowerCase().includes(q)) : folders;
	}
}

export class FileSuggest extends BaseSuggest {
	protected getSuggestions(query: string): string[] {
		const q = query.trim().toLowerCase();
		const files = this.app.vault.getMarkdownFiles().map((f) => f.path);
		return q ? files.filter((p) => p.toLowerCase().includes(q)) : files;
	}
}

// Folder picker for a normal settings row: a text field that shows Obsidian's
// native folder-suggestion dropdown.
export function addFolderPicker(
	setting: Setting,
	app: App,
	currentValue: string,
	onChange: (value: string) => void,
): void {
	setting.addText((text) => {
		text.setPlaceholder(tr('settings-folder-placeholder'));
		text.setValue(currentValue);
		text.onChange(onChange);
		new FolderSuggest(app, text.inputEl);
	});
}

// Folder picker for a collapsible group header (no surrounding Setting row).
export function addFolderPickerToControl(
	containerEl: HTMLElement,
	app: App,
	currentValue: string,
	onChange: (value: string) => void,
): void {
	const text = new TextComponent(containerEl);
	text.inputEl.addClass('babylon-folder-input');
	text.setPlaceholder(tr('settings-folder-placeholder'));
	text.setValue(currentValue);
	text.onChange(onChange);
	new FolderSuggest(app, text.inputEl);
}

// File picker for a normal settings row: a text field that shows Obsidian's
// native markdown-file suggestion dropdown.
export function addFilePicker(
	setting: Setting,
	app: App,
	currentValue: string,
	onChange: (value: string) => void,
): void {
	setting.addText((text) => {
		text.setPlaceholder(tr('settings-template-placeholder'));
		text.setValue(currentValue);
		text.onChange(onChange);
		new FileSuggest(app, text.inputEl);
	});
}
