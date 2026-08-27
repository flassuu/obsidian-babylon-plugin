// Format a date using a moment-style token string such as "YYYY-MM-DD".
// Limited to the tokens we expose in the UI: YYYY/YY, MMMM/MMM/MM/M, DDD/DD/D.
const MONTHS_FULL = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
	'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
	'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDate(date: Date, format: string): string {
	const y = date.getFullYear();
	const m = date.getMonth() + 1;
	const d = date.getDate();

	// long tokens first so "YYYY" wins over "YYY"/"YY"
	return format
		.replace(/YYYY/g, String(y))
		.replace(/YY/g, String(y % 100).padStart(2, '0'))
		.replace(/MMMM/g, MONTHS_FULL[m - 1] ?? String(m))
		.replace(/MMM/g, MONTHS_SHORT[m - 1] ?? String(m))
		.replace(/MM/g, String(m).padStart(2, '0'))
		.replace(/\bM\b/g, String(m))
		.replace(/DD/g, String(d).padStart(2, '0'))
		.replace(/\bD\b/g, String(d));
}
