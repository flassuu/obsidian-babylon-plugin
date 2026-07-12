import { registerFieldSet } from './FieldRegistry';
import { animeCategories, animeFields } from './definitions/anime';

export function initFields(): void {
	registerFieldSet('anime', animeCategories, animeFields);
}
