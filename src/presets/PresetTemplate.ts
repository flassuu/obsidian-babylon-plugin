import { App, TFile } from 'obsidian';
import type { MediaDetails } from '../types';
import type { MediaPreset } from './types';
import { PresetFormatter } from './PresetFormatter';
import { resolveDetailsValue } from './PresetFrontmatter';
import { escapeYamlDoubleQuotes } from '../utils/yaml';

const PLACEHOLDER_RE = /\{\{([^{}]+)\}\}/g;

function toArray(raw: unknown): unknown[] {
	if (Array.isArray(raw)) return raw;
	if (typeof raw === 'string') {
		return raw.split(',').map((s) => s.trim()).filter(Boolean);
	}
	return raw === null || raw === undefined ? [] : [raw];
}

// build a flat property -> string map for template substitution. every preset
// property becomes an alias; for arrays the "_list" suffix renders a YAML list.
// the apiKey is kept as a secondary alias for smoother legacy-template use.
function buildValueMap(details: MediaDetails, preset: MediaPreset): Record<string, string> {
	const formatter = new PresetFormatter();
	const map: Record<string, string> = {};
	const fields = [...preset.fields].sort((a, b) => a.order - b.order);

	for (const f of fields) {
		const raw = resolveDetailsValue(details, f.apiKey);
		if (raw === undefined || raw === null) continue;

		const names: string[] = [f.property];
		if (f.apiKey !== f.property) names.push(f.apiKey);

		if (f.type === 'array') {
			const arr = toArray(raw);
			const joined = arr.map(String).join(', ');
			const list = arr
				.map((v) => `  - "${escapeYamlDoubleQuotes(String(v))}"`)
				.join('\n');
			for (const name of names) {
				map[name] = joined;
				map[`${name}_list`] = list;
			}
			continue;
		}

		const formatted = formatter.apply(raw, f.format);
		if (formatted === null) continue;
		const s = String(formatted);
		for (const name of names) {
			map[name] = s;
		}
	}

	return map;
}

// strip a leading YAML frontmatter block from a template body — the preset owns
// the frontmatter in the hybrid model.
function stripFrontmatter(template: string): string {
	const m = template.match(/^---\n[\s\S]*?\n---\n/);
	return m ? template.slice(m[0].length) : template;
}

// render the note body from a template file: {{property}} -> formatted value.
// unknown placeholders are left as-is.
export async function renderPresetBody(
	app: App,
	templatePath: string,
	details: MediaDetails,
	preset: MediaPreset,
): Promise<string> {
	let template = '';
	if (templatePath) {
		const file = app.vault.getAbstractFileByPath(templatePath);
		if (file instanceof TFile) {
			try {
				template = await app.vault.read(file);
			} catch {
				template = '';
			}
		}
	}
	if (!template) return '';

	const body = stripFrontmatter(template);
	const values = buildValueMap(details, preset);

	return body.replace(PLACEHOLDER_RE, (match: string, key: string): string => {
		const trimmed = key.trim();
		return values[trimmed] ?? match;
	});
}
