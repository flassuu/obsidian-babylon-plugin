// Obsidian-native settings group built on plain divs — the same structure
// Obsidian's own settings use (.setting-group / .setting-item-heading /
// .setting-items). No <details>/<summary>: open state is driven only by a
// CSS class, so header clicks never fold unless we wire them explicitly.

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
	// when false the header is a plain heading: clicking it never folds/unfolds,
	// open state is driven only via setOpen() (e.g. by an enable toggle)
	toggleable?: boolean;
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
	const group = container.createEl('div', {
		cls: `setting-group babylon-collapsible babylon-collapsible-level-${config.level ?? 1}`,
	});
	if (config.key) group.dataset.collapseKey = config.key;

	const header = group.createEl('div', {
		cls: 'setting-item setting-item-heading babylon-collapsible-header'
			+ (config.toggleable === false ? ' mod-static' : ''),
	});

	const name = header.createDiv({ cls: 'setting-item-name' });
	name.createSpan({ text: config.title });
	if (config.desc) {
		name.createDiv({ text: config.desc, cls: 'babylon-collapsible-desc' });
	}

	if (config.headerControl) {
		const controls = header.createDiv({
			cls: 'setting-item-control babylon-collapsible-controls',
		});
		config.headerControl(controls);
		// interactive controls must not fold the group when clicked
		controls.addEventListener('click', (e) => e.stopPropagation());
	}

	const body = group.createDiv({ cls: 'setting-items babylon-collapsible-body' });

	const applyState = (open: boolean): void => {
		group.toggleClass('is-open', open);
	};
	applyState(config.defaultOpen ?? false);

	// foldable groups fold on header click; toggle-driven groups stay static
	if (config.toggleable !== false) {
		header.addEventListener('click', () => applyState(!group.classList.contains('is-open')));
	}

	return {
		details: group,
		body,
		setOpen: applyState,
		isOpen: () => group.classList.contains('is-open'),
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
