import type { MediaType, ProviderId } from '../types';

export interface FieldCategory {
	id: string;
	labelKey: string;
	icon: string;
}

export type ObsidianFormat = 'text' | 'number' | 'checkbox' | 'date' | 'datetime' | 'list';

const FORMAT_FROM_TYPE: Record<string, ObsidianFormat> = {
	string: 'text',
	number: 'number',
	boolean: 'checkbox',
	date: 'date',
	array: 'list',
	object: 'text',
};

export function resolveFormat(def: FieldDefinition): ObsidianFormat {
	return def.format ?? FORMAT_FROM_TYPE[def.type] ?? 'text';
}

export interface FieldDefinition {
	key: string;
	labelKey: string;
	category: string;
	type: 'string' | 'number' | 'array' | 'date' | 'boolean' | 'object';
	format?: ObsidianFormat;
	personal: boolean;
	provider?: ProviderId;
	graphql: string;
	always?: boolean;
	descriptionKey?: string;
}

export interface MediaFieldSet {
	mediaType: MediaType;
	categories: FieldCategory[];
	fields: FieldDefinition[];
}
