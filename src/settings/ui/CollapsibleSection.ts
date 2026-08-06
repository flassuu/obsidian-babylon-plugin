// Obsidian-native collapsible group built on <details>/<summary>.
// Styled with standard Obsidian CSS variables so community themes keep working.
// The header can carry an optional control (e.g. an enable toggle) that does
// not trigger the collapse when clicked.

export interface CollapsibleConfig {
	title: string;
	desc?: string;
	defaultOpen?: boolean;
	// stable id used to preserve open state across settings re-renders
	key?: string;
	// 1 = top-level group, higher = nested deeper
	level?: number;
	// optional right-side header control (toggle / buttons)
	headerControl?: (controls: HTMLElement) => void;
}

export interface CollapsibleSection {
	details: HTMLElement;
	body: HTMLElement;
	setOpen(open: boolean): void;
	isOpen(): boolean;
}

export function createCollapsible(
	container: HTMLElement,
	config: CollapsibleConfig,
): CollapsibleSection {
	const details = container.createEl('details', {
		cls: `babylon-collapsible babylon-collapsible-level-${config.level ?? 1}`,
	});
	if (config.defaultOpen) details.open = true;
	if (config.key) details.dataset.collapseKey = config.key;

	const summary = details.createEl('summary', { cls: 'babylon-collapsible-header' });

	const title = summary.createDiv({ cls: 'babylon-collapsible-title' });
	title.createSpan({ text: config.title, cls: 'babylon-collapsible-title-text' });
	if (config.desc) {
		title.createDiv({ text: config.desc, cls: 'babylon-collapsible-desc' });
	}

	if (config.headerControl) {
		const controls = summary.createDiv({ cls: 'babylon-collapsible-controls' });
		config.headerControl(controls);
		// interactive controls must not toggle the <details> on click
		controls.addEventListener('click', (e) => e.stopPropagation());
	}

	const body = details.createDiv({ cls: 'babylon-collapsible-body' });

	return {
		details,
		body,
		setOpen: (open) => {
			details.open = open;
		},
		isOpen: () => details.open,
	};
}

// Obsidian-native toggle switch (.checkbox-container). Themes style it natively.
export function createObsidianToggle(
	container: HTMLElement,
	checked: boolean,
	onChange: (checked: boolean) => void,
	ariaLabel?: string,
): HTMLElement {
	const label = container.createEl('label', { cls: 'checkbox-container' });
	if (checked) label.addClass('is-enabled');
	if (ariaLabel) label.setAttribute('aria-label', ariaLabel);

	const input = label.createEl('input', { attr: { type: 'checkbox' } });
	input.checked = checked;

	input.addEventListener('change', () => {
		const on = input.checked;
		label.toggleClass('is-enabled', on);
		onChange(on);
	});

	return label;
}
