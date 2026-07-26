import type BabylonPlugin from '../main';

export class NoteIgnoreStore {
	private plugin: BabylonPlugin;

	constructor(plugin: BabylonPlugin) {
		this.plugin = plugin;
	}

	getIgnoredFields(sourceId: string): string[] {
		return this.plugin.settings.noteIgnoreOverrides[sourceId] ?? [];
	}

	isFieldIgnored(sourceId: string, fieldKey: string): boolean {
		return this.getIgnoredFields(sourceId).includes(fieldKey);
	}

	async addIgnoredField(sourceId: string, fieldKey: string): Promise<void> {
		const current = this.getIgnoredFields(sourceId);
		if (!current.includes(fieldKey)) {
			current.push(fieldKey);
			this.plugin.settings.noteIgnoreOverrides[sourceId] = current;
			await this.plugin.saveSettings();
		}
	}

	async removeIgnoredField(sourceId: string, fieldKey: string): Promise<void> {
		const current = this.getIgnoredFields(sourceId);
		const filtered = current.filter((k) => k !== fieldKey);
		if (filtered.length === 0) {
			delete this.plugin.settings.noteIgnoreOverrides[sourceId];
		} else {
			this.plugin.settings.noteIgnoreOverrides[sourceId] = filtered;
		}
		await this.plugin.saveSettings();
	}

	getAllIgnored(): Record<string, string[]> {
		return { ...this.plugin.settings.noteIgnoreOverrides };
	}
}
