import type { FieldCategory, FieldDefinition } from '../types';

export const sharedCategories: FieldCategory[] = [
	{ id: 'core', labelKey: 'field-cat-core', icon: 'info' },
];

const CORE_FRAGMENT = `
  id
  title { romaji english native }
  coverImage { extraLarge large medium color }
  seasonYear
  format
  episodes
  genres
  description
  siteUrl
  status
`.trim();

export const sharedFields: FieldDefinition[] = [
	{
		key: 'title',
		labelKey: 'field-title',
		category: 'core',
		type: 'string',
		personal: false,
		graphql: '',
		always: true,
	},
	{
		key: 'originalTitle',
		labelKey: 'field-original-title',
		category: 'core',
		type: 'string',
		personal: false,
		graphql: '',
		always: true,
	},
	{
		key: 'year',
		labelKey: 'field-year',
		category: 'core',
		type: 'number',
		personal: false,
		graphql: '',
		always: true,
	},
	{
		key: 'description',
		labelKey: 'field-description',
		category: 'core',
		type: 'string',
		personal: false,
		graphql: '',
		always: false,
	},
	{
		key: 'cover',
		labelKey: 'field-cover',
		category: 'core',
		type: 'string',
		personal: false,
		graphql: '',
		always: true,
	},
	{
		key: 'genres',
		labelKey: 'field-genres',
		category: 'core',
		type: 'array',
		personal: false,
		graphql: '',
		always: false,
	},
	{
		key: 'siteUrl',
		labelKey: 'field-site-url',
		category: 'core',
		type: 'string',
		personal: false,
		graphql: '',
		always: false,
	},
];

export const SHARED_ALWAYS_GRAPHQL = CORE_FRAGMENT;
