import type { ContentProvider, MediaType, ProviderId } from '../types';

export class ProviderRegistry {
	private providers: Map<ProviderId, ContentProvider> = new Map();
	private typeMap: Map<MediaType, ContentProvider> = new Map();

	register(provider: ContentProvider): void {
		this.providers.set(provider.id, provider);
		for (const type of provider.mediaTypes) {
			this.typeMap.set(type, provider);
		}
	}

	forType(type: MediaType): ContentProvider | null {
		return this.typeMap.get(type) ?? null;
	}

	get(id: ProviderId): ContentProvider | null {
		return this.providers.get(id) ?? null;
	}
}
