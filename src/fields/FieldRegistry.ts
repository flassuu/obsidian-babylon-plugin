import type { MediaType } from '../types';
import type { FieldCategory, FieldDefinition } from './types';

const mediaFieldSets: Map<MediaType, { categories: FieldCategory[]; fields: FieldDefinition[] }> = new Map();

export function registerFieldSet(
	mediaType: MediaType,
	categories: FieldCategory[],
	fields: FieldDefinition[],
): void {
	mediaFieldSets.set(mediaType, { categories, fields });
}

export function getCategories(mediaType: MediaType): FieldCategory[] {
	return mediaFieldSets.get(mediaType)?.categories ?? [];
}

export function getFields(mediaType: MediaType): FieldDefinition[] {
	return mediaFieldSets.get(mediaType)?.fields ?? [];
}

export function getFieldsByCategory(mediaType: MediaType): Map<string, FieldDefinition[]> {
	const grouped = new Map<string, FieldDefinition[]>();
	const fields = getFields(mediaType);
	for (const f of fields) {
		const list = grouped.get(f.category) ?? [];
		list.push(f);
		grouped.set(f.category, list);
	}
	return grouped;
}

export function getFieldByKey(mediaType: MediaType, key: string): FieldDefinition | undefined {
	return getFields(mediaType).find((f) => f.key === key);
}

export function getAlwaysFields(mediaType: MediaType): string[] {
	return getFields(mediaType)
		.filter((f) => f.always)
		.map((f) => f.key);
}
