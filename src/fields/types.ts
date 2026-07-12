import type { MediaType, ProviderId } from '../types';

export interface FieldCategory {
	id: string;
	labelKey: string;
	icon: string;
}

export interface FieldDefinition {
	key: string;
	labelKey: string;
	category: string;
	type: 'string' | 'number' | 'array' | 'date' | 'boolean';
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
