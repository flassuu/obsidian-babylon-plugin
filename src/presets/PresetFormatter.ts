import type { DateFormat, FieldCase, FieldFormat, NumberFormat } from './types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DateParts {
	y: number;
	m: number;
	d: number;
}

function toDateParts(value: unknown): DateParts | null {
	if (value instanceof Date && !isNaN(value.getTime())) {
		return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
	}
	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		const y = typeof obj['year'] === 'number' ? obj['year'] : Number(obj['year'] ?? NaN);
		const m = typeof obj['month'] === 'number' ? obj['month'] : Number(obj['month'] ?? NaN);
		const d = typeof obj['day'] === 'number' ? obj['day'] : Number(obj['day'] ?? NaN);
		if (!isNaN(y) && y > 0) return { y, m: isNaN(m) ? 0 : m, d: isNaN(d) ? 0 : d };
	}
	if (typeof value === 'string') {
		const m = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
		if (m) return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
		const yOnly = value.match(/^(\d{4})$/);
		if (yOnly) return { y: Number(yOnly[1]), m: 0, d: 0 };
	}
	return null;
}

function renderDate(parts: DateParts, format: DateFormat): string {
	const y = parts.y;
	const m = parts.m;
	const d = parts.d;

	switch (format) {
		case 'DD.MM.YYYY':
			return [d > 0 ? String(d).padStart(2, '0') : '', m > 0 ? String(m).padStart(2, '0') : '', String(y)]
				.filter(Boolean).join('.');
		case 'YYYY/MM/DD':
			return [String(y), m > 0 ? String(m).padStart(2, '0') : '', d > 0 ? String(d).padStart(2, '0') : '']
				.filter(Boolean).join('/');
		case 'D MMM YYYY':
			if (d > 0 && m > 0) return `${d} ${MONTHS_SHORT[m - 1] ?? ''} ${y}`.replace(/\s+/g, ' ');
			return String(y);
		case 'YYYY-MM-DD':
		default:
			return [String(y), m > 0 ? String(m).padStart(2, '0') : '', d > 0 ? String(d).padStart(2, '0') : '']
				.filter(Boolean).join('-');
	}
}

function applyCase(value: string, c: FieldCase): string {
	switch (c) {
		case 'lower':
			return value.toLowerCase();
		case 'upper':
			return value.toUpperCase();
		case 'capitalize':
			return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
		case 'title':
			return value
				.toLowerCase()
				.split(/(\s+)/)
				.map((w) => (/^\s+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
				.join('');
		case 'none':
		default:
			return value;
	}
}

function applyNumberScale(value: number, fmt: NumberFormat): number {
	let n = value;
	if (fmt.scaleFrom && fmt.scaleTo) {
		n = n * (fmt.scaleTo / fmt.scaleFrom);
	}
	if (fmt.round !== undefined) {
		const f = Math.pow(10, fmt.round);
		n = Math.round(n * f) / f;
	}
	return n;
}

/**
 * Pure formatting engine. Applied in order: valueMap → case → dateFormat → number.
 * Returns a scalar ready for YAML serialization; null means "no value".
 */
export class PresetFormatter {
	apply(raw: unknown, format?: FieldFormat): string | number | boolean | null {
		if (raw === null || raw === undefined) return null;
		if (Array.isArray(raw)) return null;

		let value: unknown = raw;

		if (format) {
			// value map runs on the raw API value so lookups match untransformed data
			if (format.valueMap) {
				const key = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
				if (key && key in format.valueMap) {
					value = format.valueMap[key];
				}
			}
			if (format.case && typeof value === 'string') {
				value = applyCase(value, format.case);
			}
			if (format.dateFormat) {
				const parts = toDateParts(value);
				if (parts) value = renderDate(parts, format.dateFormat);
			}
			if (format.number) {
				const n = typeof value === 'string' ? Number(value) : value;
				if (typeof n === 'number' && !isNaN(n)) {
					value = applyNumberScale(n, format.number);
				}
			}
		}

		return toScalar(value);
	}
}

function toScalar(value: unknown): string | number | boolean | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return Number.isNaN(value) ? null : value;
	if (typeof value === 'boolean') return value;
	// date-like objects without a dateFormat flag collapse to ISO
	const parts = toDateParts(value);
	if (parts) return renderDate(parts, 'YYYY-MM-DD');
	return null;
}
