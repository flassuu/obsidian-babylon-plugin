// minimal YAML serialization helpers shared by the preset frontmatter builder,
// sync engine and other note writers.

// quote a string for a YAML scalar when it contains yaml-significant characters
export function needsYamlQuoting(s: string): boolean {
	if (s.length === 0) return true;
	// already quoted
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return false;
	// yaml-significant characters
	if (/[[\]{}:,*&?!|<>'"%@`#]/.test(s)) return true;
	if (/^[^a-zA-Z0-9]/.test(s)) return true;
	if (s.includes('  ')) return true;
	return false;
}

export function escapeYamlDoubleQuotes(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// serialize a single top-level key:value pair for a scalar value
export function serializeYamlValue(key: string, val: string | number | boolean | null): string {
	if (val === null || val === undefined) {
		return `${key}: `;
	}

	if (typeof val === 'number') {
		return `${key}: ${val}`;
	}

	if (typeof val === 'boolean') {
		return `${key}: ${val ? 'true' : 'false'}`;
	}

	// string — quote if it contains yaml-significant characters
	if (needsYamlQuoting(val)) {
		return `${key}: "${escapeYamlDoubleQuotes(val)}"`;
	}

	return `${key}: ${val}`;
}

// serialize a single list item value (used inside a YAML block list)
function serializeListItem(v: unknown): string {
	if (v === null || v === undefined) return 'null';
	if (typeof v === 'string') return `"${escapeYamlDoubleQuotes(v)}"`;
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	if (typeof v === 'object') return `"${escapeYamlDoubleQuotes(JSON.stringify(v) ?? '')}"`;
	if (typeof v === 'bigint' || typeof v === 'symbol') return String(v);
	return '';
}

// build a YAML block-list for an array value:
//   key:
//     - "item1"
//     - "item2"
export function serializeYamlListLines(key: string, values: unknown[]): string {
	const lines = [`${key}:`];
	for (const v of values) {
		lines.push(`  - ${serializeListItem(v)}`);
	}
	return lines.join('\n');
}
