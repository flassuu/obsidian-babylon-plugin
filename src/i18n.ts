import type { SupportedLocale } from './types';

type TranslationTable = Record<string, string>;

const en: TranslationTable = {
	'settings-general': 'General',
	'settings-language': 'Language',
	'settings-api-keys': 'API Keys',
	'settings-media': 'Media Types',
	'settings-media-anime': 'Anime',
	'settings-media-movie': 'Movies',
	'settings-media-series': 'Series',
	'settings-folder': 'Output folder',
	'settings-folder-desc': 'Folder where notes will be created',
	'settings-template': 'Template file',
	'settings-template-desc': 'Path to a .md template file inside your vault',
	'settings-template-missing': 'Template file not found. Create it first.',
	'settings-enabled': 'Enabled',
	'settings-provider': 'Provider',
	'settings-api-key-omdb': 'OMDb API Key',
	'settings-api-key-rawg': 'RAWG API Key',
	'settings-api-key-google': 'Google Books API Key',
	'settings-api-key-steam': 'Steam API Key',
	'add-content': 'Add content',
	'add-content-desc': 'Search and add media to your library',
	'search-placeholder': 'Search...',
	'search-no-results': 'No results found',
	'search-error': 'Search failed',
	'create-note-success': 'Note created',
	'create-note-error': 'Failed to create note',
	'file-exists': 'File already exists. Overwrite?',
	'choose-type': 'Choose media type',
	'anime': 'Anime',
	'movie': 'Movie',
	'series': 'Series',
	'cancel': 'Cancel',
	'confirm': 'Confirm',
	'yes': 'Yes',
	'no': 'No',
};

const ru: TranslationTable = {
	'settings-general': 'Основные',
	'settings-language': 'Язык',
	'settings-api-keys': 'Ключи API',
	'settings-media': 'Типы контента',
	'settings-media-anime': 'Аниме',
	'settings-media-movie': 'Фильмы',
	'settings-media-series': 'Сериалы',
	'settings-folder': 'Папка для заметок',
	'settings-folder-desc': 'Папка, куда будут создаваться заметки',
	'settings-template': 'Файл шаблона',
	'settings-template-desc': 'Путь к .md файлу шаблона внутри хранилища',
	'settings-template-missing': 'Файл шаблона не найден. Создайте его сначала.',
	'settings-enabled': 'Включено',
	'settings-provider': 'Провайдер',
	'settings-api-key-omdb': 'Ключ API OMDb',
	'settings-api-key-rawg': 'Ключ API RAWG',
	'settings-api-key-google': 'Ключ API Google Books',
	'settings-api-key-steam': 'Ключ API Steam',
	'add-content': 'Добавить контент',
	'add-content-desc': 'Найти и добавить контент в библиотеку',
	'search-placeholder': 'Поиск...',
	'search-no-results': 'Ничего не найдено',
	'search-error': 'Ошибка поиска',
	'create-note-success': 'Заметка создана',
	'create-note-error': 'Не удалось создать заметку',
	'file-exists': 'Файл уже существует. Перезаписать?',
	'choose-type': 'Выберите тип контента',
	'anime': 'Аниме',
	'movie': 'Фильм',
	'series': 'Сериал',
	'cancel': 'Отмена',
	'confirm': 'Подтвердить',
	'yes': 'Да',
	'no': 'Нет',
};

const tables: Record<SupportedLocale, TranslationTable> = { en, ru };

let currentLocale: SupportedLocale = 'en';

export function setLocale(locale: SupportedLocale): void {
	currentLocale = locale;
}

export function tr(key: string, vars?: Record<string, string | number>): string {
	const table = tables[currentLocale] ?? tables.en;
	let text = table[key] ?? tables.en[key] ?? key;
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
		}
	}
	return text;
}
