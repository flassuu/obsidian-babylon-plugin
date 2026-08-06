// Snapshot scroll position (and <details> open states) before a re-render,
// then restore them after the new DOM is in place. Prevents the whole list
// jumping back to the top whenever a modal/settings section re-renders.
//
// `scrollerSelector` targets an inner scrollable list that gets rebuilt by the
// render (e.g. the field list in the preset editor). Without it, the nearest
// scrollable ancestor of `container` is preserved instead.

export function preserveReRenderState(
	container: HTMLElement,
	render: () => void,
	scrollerSelector?: string,
): void {
	const walkScroller = findScrollContainer(container);
	const walkTop = walkScroller?.scrollTop ?? 0;

	const innerScroller = scrollerSelector
		? container.querySelector(scrollerSelector)
		: null;
	const innerTop = innerScroller ? innerScroller.scrollTop : 0;

	const detailsStates = new Map<string, boolean>();
	container.querySelectorAll('details').forEach((el) => {
		const key = el.dataset.collapseKey ?? (el.textContent?.trim() ?? '');
		detailsStates.set(key, el.open);
	});

	render();

	const newWalk = findScrollContainer(container);
	if (newWalk) newWalk.scrollTop = walkTop;

	if (scrollerSelector) {
		const newInner = container.querySelector(scrollerSelector);
		if (newInner) newInner.scrollTop = innerTop;
	}

	container.querySelectorAll('details').forEach((el) => {
		const key = el.dataset.collapseKey ?? (el.textContent?.trim() ?? '');
		const wasOpen = detailsStates.get(key);
		if (wasOpen !== undefined) el.open = wasOpen;
	});
}

// nearest ancestor (or the element itself) that actually scrolls
function findScrollContainer(el: HTMLElement): HTMLElement | null {
	let node: HTMLElement | null = el;
	while (node) {
		if (node.scrollHeight > node.clientHeight) return node;
		node = node.parentElement;
	}
	return null;
}
