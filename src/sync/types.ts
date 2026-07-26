import type { MediaType } from '../types';

export interface SyncFieldSetting {
	key: string;
	property: string;
	type: 'number' | 'string' | 'date' | 'boolean';
	sync: boolean;
}

export interface SyncFieldMap {
	version: number;
	mediaType: MediaType;
	syncFields: SyncFieldSetting[];
}

export interface SyncFieldChange {
	fieldKey: string;
	propertyName: string;
	localValue: string | number | null;
	remoteValue: string | number | null;
}

export interface NoteSyncChange {
	sourceId: string;
	title: string;
	filePath: string;
	changes: SyncFieldChange[];
}

export interface SyncResult {
	mediaType: MediaType;
	changes: NoteSyncChange[];
}
