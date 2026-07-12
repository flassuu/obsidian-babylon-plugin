# Babylon Plugin — Technical Specification

> **Version:** 0.3.0 (Templates & Customization)
> **Last updated:** 2026-07-12
> **Platform:** Obsidian 1.12+ (cross-platform, desktop-focused)
> **ID:** `babylon`
> **Language:** TypeScript (strict), bundled via esbuild → CJS → `main.js`

---

## 1. Core types

```typescript
type MediaType = 'anime' | 'movie' | 'series' | 'game' | 'book' | 'custom';

type ProviderId =
  | 'anilist'
  | 'omdb'
  | 'steam'
  | 'rawg'
  | 'howlongtobeat'
  | 'openlibrary'
  | 'googlebooks';

type SupportedLocale = 'en' | 'ru';

type TemplateMode = 'simple' | 'advanced';

interface MediaTypeSettings {
  enabled: boolean;
  folder: string;              // vault-relative output path
  provider: ProviderId | null;
  templatePath: string;        // vault-relative .md template (advanced mode)
  selectedFields: string[];    // field keys checked in the visual picker
  customFieldNames: string[];  // user-typed custom field names
  templateMode: TemplateMode;  // simple = auto, advanced = custom .md
}

interface SearchResult {
  provider: ProviderId;
  sourceId: string;
  title: string;
  year: number | null;
  subtitle: string | null; // Additional info (author, genres, type)
  cover: string | null;    // Poster URL
  raw: unknown;            // Raw API response (for detail fetch)
}

interface MediaDetails {
  title: string;
  originalTitle: string | null;
  year: number | null;
  description: string | null;
  cover: string | null;
  genres: string[];
  creators: string[];       // Studios, directors, developers
  rating: number | null;
  url: string | null;
  format: string | null;
  progressTotal: number | null;
  sourceId: string;
  provider: ProviderId;
  [key: string]: unknown;  // Custom fields from provider
}
```

**Current types in `src/types.ts` match the above.**

---

## 2. Settings structure (`src/settings/defaults.ts`)

The actual settings model differs from the original spec. Current implementation:

```typescript
interface BabylonSettings {
  language: SupportedLocale;
  templateFolder: string;        // default folder for template files
  apiKeys: {
    omdb: string;
    rawg: string;
    googleBooks: string;
    steam: string;
  };
  anilistAuth: {
    personalizationEnabled: boolean;
    accessToken: string;
    customFields: string;            // backward compat (migrated)
    customFieldsPublic: string;      // backward compat (migrated)
    customFieldsPrivate: string;     // backward compat (migrated)
  };
  anilistSync: {
    enabled: boolean;
    syncOnStartup: boolean;
    twoWaySync: boolean;
  };
  media: Partial<Record<MediaType, MediaTypeSettings>>;
}
```

Settings are stored in `data.json` via Obsidian's `plugin.loadData()` / `saveData()`.

**DEFAULT_SETTINGS** (`src/settings/defaults.ts`):
- `language`: `'en'`
- `templateFolder`: `'Templates'`
- `anime` enabled with `'anilist'` provider
- `movie` enabled with no provider
- `series`/`game`/`book` disabled
- `anilistAuth.personalizationEnabled`: `false`
- `anime.selectedFields`: ~17 default field keys (title, year, genres, cover, format, episodes, status, averageScore, meanScore, progress, score, startedAt, completedAt, notes, synonyms, tags)
- `anime.templateMode`: `'simple'`
- Old `customFields*` migrated to new format on load via `migrateSettings()`

---

## 3. Providers — details

### 3.1 AniList (`src/providers/anilist.ts`)

- **API:** https://graphql.anilist.co (GraphQL)
- **Auth:** Personal Access Token (Bearer token via OAuth PIN flow). Not required for public search, required for personalization/sync.
- **Client ID:** `45744`
- **Search:** `Page` query with `search`, `type: ANIME`, limit 20. Always returns base fields (id, title, coverImage, seasonYear, format, episodes, averageScore, genres, description, siteUrl, status) plus any extra fields from user's selection.
- **Details:** `Media` query by `id` — dynamically assembled from `FieldRegistry`:
  - Always includes base fields for rendering
  - Adds GraphQL fragments for each user-selected field
  - Adds `mediaListEntry { }` only if personal fields selected AND token present
  - Custom typed field names assumed top-level scalars on the Media type
- **Title selection:** English > Romaji > Native.
- **Field definitions:** `src/fields/definitions/anime.ts` — ~40 fields across 6 categories

### 3.2 Other providers (planned)

Stub files exist for OMDb, Steam, RAWG, HowLongToBeat, OpenLibrary, Google Books. None are currently registered or functional.

### 3.3 Registry (`src/providers/registry.ts`)

```typescript
class ProviderRegistry {
  private providers: Map<ProviderId, ContentProvider>;
  register(provider: ContentProvider): void;
  get(id: ProviderId): ContentProvider | null;
}
```

---

## 3.4 Field Registry (`src/fields/`)

Central registry for all available fields per media type.

### Types (`src/fields/types.ts`)

```typescript
interface FieldCategory {
  id: string;           // 'core' | 'ratings' | 'technical' | 'personal' | 'media' | 'rankings'
  labelKey: string;     // i18n key
  icon: string;         // Lucide icon name
}

interface FieldDefinition {
  key: string;           // 'averageScore'
  labelKey: string;      // i18n key
  category: string;      // references category.id
  type: 'string' | 'number' | 'array' | 'date' | 'boolean';
  personal: boolean;     // requires auth token
  provider?: ProviderId; // null = universal
  graphql: string;       // GraphQL fragment (can be nested)
  always?: boolean;      // always include in query (id, title)
}
```

### Registry (`src/fields/FieldRegistry.ts`)

- `registerFieldSet(mediaType, categories, fields)` — register fields for a media type
- `getFields(mediaType)` — get all field definitions
- `getCategories(mediaType)` — get all categories
- `getFieldsByCategory(mediaType)` — get fields grouped by category
- `getFieldByKey(mediaType, key)` — lookup a single field

### Definitions

- `shared.ts` — universal fields (title, year, genres, cover, description, siteUrl — used across all media types)
- `anime.ts` — AniList-specific fields with GraphQL fragments, 6 categories, ~40 fields
  - Core (10 fields): title, originalTitle, year, description, cover, bannerImage, genres, synonyms, countryOfOrigin, siteUrl
  - Ratings (4): averageScore, meanScore, popularity, favourites
  - Technical (9): format, status, episodes, duration, season, source, hashtag, updatedAt, isAdult
  - Personal (8, require auth): progress, score, myStatus, startedAt, completedAt, notes, repeat, progressVolumes
  - Media (5): tags, studios, trailer, streamingEpisodes, externalLinks
  - Rankings (1): rankings

### Initialization

`initFields()` in `src/fields/index.ts` registers all default field sets. Called from `main.ts` during `onload()`.

### Migration

`migrateSettings()` in `src/settings/defaults.ts` converts old `customFieldsPublic`/`customFieldsPrivate` textareas to the new `selectedFields` + `customFieldNames` array format on plugin load.

---

## 4. Settings UI (`src/settings/SettingsTab.ts`)

### 4.1 About
- Plugin name + version + author link (left column)
- GitHub, Discord (outline logo), Discussions, Donate buttons (right column, 2×2 grid)
- All in a bordered card

### 4.2 General
- Language dropdown (en/ru)
- Template folder — default path for storing .md template files (default: `Templates`)

### 4.3 Media Types

#### Anime
- Toggle (enabled/disabled)
- Provider (AniList only)
- Enable personalization toggle
  - Token field + (?) instructions modal + Authorize button
  - Test connection (shows username + stats)
  - Sync (enable → startup + two-way toggles)
- Output folder
- **Template mode** — dropdown (Simple / Advanced)
  - **Simple:** Field selector (grouped checkboxes by category) + custom field text input + "Generate Simple Template" button
  - **Advanced:** Template path text field (path to .md file)

#### Movies / Series / Games / Books
- Toggle + basic settings (folder, template path) + "coming soon" note

### 4.4 API Keys
- OMDb, RAWG, Google Books, Steam key fields (stored for future providers)

---

## 5. Content Service (`src/services/ContentService.ts`)

```typescript
class ContentService {
  constructor(private app: App);

  async createNote(
    type: MediaType,
    details: MediaDetails,
    settings: BabylonSettings,
  ): Promise<TFile | null>;
}
```

**`createNote` algorithm:**
1. Determine folder from settings for the given MediaType
2. Generate filename: `{sanitized title} - {sourceId}.md`
3. Check if file exists → prompt overwrite (modal)
4. Load template (.md file) or use built-in default
5. Render template via `TemplateService.render(template, details)`
6. Create file via `app.vault.create(path, content)`
7. Return `TFile`

---

## 6. Template Service (`src/services/TemplateService.ts`)

```typescript
class TemplateService {
  render(template: string, details: Record<string, unknown>): string;
  renderDefaultTemplate(details: Record<string, unknown>): string;
}
```

- Template is a `.md` file with `{{placeholder}}` syntax
- Placeholders resolved from `MediaDetails` object + custom fields
- If no template configured, built-in default template is used
- Unknown placeholders (`{{unknown}}`) are left as-is
- See `TEMPLATE.md` for full placeholder reference

---

## 7. Sync System

### 7.1 AniList Sync (`src/services/AnilistSyncService.ts`)

**Two-way sync:**

```
1. Fetch all user entries from AniList (MediaListCollection)
   - Requires two-step: Viewer query → userId → MediaListCollection
2. Scan all .md files in the anime output folder
3. For each note with source_id matching an AniList entry:
   a. Compare local fields (status, score, progress, notes) with remote
   b. If different → show ConflictModal:
      - "Keep local" — keep local data unchanged
      - "Use remote" — overwrite local with AniList data
      - "Push to AniList" — send local data to AniList (mutation)
      - "Skip" — skip this entry
   c. Apply chosen action
4. New AniList entries (no local note) → create notes
5. Local notes not on AniList → skip (future: archive)
```

**GraphQL:**
- `Viewer { id }` — get user ID
- `MediaListCollection(userId, type: ANIME) { lists { entries { ... } } }` — fetch list
- `SaveMediaListEntry` mutation — push changes

### 7.2 Steam Sync (planned)

Not yet implemented. See ROADMAP Stage 5.

---

## 8. UI / Commands

### 8.1 Commands

| ID | Name | Description |
|----|------|-------------|
| `babylon:add-content` | Babylon: Add content | Type picker → search → create note |
| `babylon:sync-anilist` | Babylon: Sync AniList | Full sync with AniList |
| `babylon:add-from-list` | Babylon: Add from AniList | Browse and import from personal list |

### 8.2 Ribbon Icons
- `library` → Babylon: Add content
- (Future: `refresh-cw` for sync)

### 8.3 Modals

**AddContentModal** (`src/ui/modals/AddContentModal.ts`):
- Search input → debounced (300ms) → fetch results → display with cover, title, year
- On select → fetch details → create note

**AddFromListModal** (`src/ui/modals/AddFromListModal.ts`):
- Fetch user's AniList → display as clickable list
- On select → create note with full details

**ConflictModal** (`src/ui/modals/ConflictModal.ts`):
- Show local vs remote differences per field
- Buttons: Keep Local, Use Remote, Push to AniList, Skip

**AuthInstructionsModal** (inline in `anilist.ts`):
- 3-step OAuth instructions

---

## 9. i18n (`src/i18n.ts`)

```typescript
type SupportedLocale = 'en' | 'ru';

function tr(key: string, vars?: Record<string, string | number>): string {
  // 1. Look up current locale from settings.language
  // 2. Replace {placeholder} with vars values
  // 3. Fallback to English key
}
```

All UI strings stored in translation tables with en ↔ ru.

---

## 10. OAuth Flow (AniList)

1. User clicks "Authorize" → `window.open()` → AniList authorization page
   - URL: `https://anilist.co/api/v2/oauth/authorize?client_id=45744&response_type=token`
   - No `redirect_uri` param — uses AniList's configured redirect (`https://anilist.co/api/v2/oauth/pin`)
2. User approves → redirected to pin page with token in URL
3. User copies token → pastes into token field (masked input)
4. "Test connection" button → fetches `Viewer` + `statistics` → displays username + stats

---

## 11. Conflict Resolution

```
┌──────────────────────────────────────┐
│  Sync Conflict                        │
│                                       │
│  "Attack on Titan"                    │
│                                       │
│  ┌──────────────────┬───────────────┐ │
│  │ Local (Obsidian)  │ Remote (AL)  │ │
│  ├──────────────────┼───────────────┤ │
│  │ Status: watching │ Status: paused│ │
│  │ Rating: 9        │ Rating: 8     │ │
│  │ Progress: 45/75  │ Progress: 40  │ │
│  └──────────────────┴───────────────┘ │
│                                       │
│  [Keep Local] [Use Remote] [Push] [X]│
└──────────────────────────────────────┘
```

- **Keep Local:** Do nothing, keep local data
- **Use Remote:** Overwrite local with AniList data
- **Push to AniList:** Send local data → AniList (via `SaveMediaListEntry` mutation)
- **Skip:** Skip this entry entirely

---

## 12. Architectural decisions

### 12.1 No React/Svelte
- Obsidian ships without them; including them would increase bundle size
- All UI via native Obsidian DOM API (`containerEl.createDiv()`, `Setting`, etc.)
- Follows patterns from Lorebase and Library plugins

### 12.2 HTTP client
- Uses `requestUrl()` from Obsidian API (works on desktop and mobile)
- Wrapper in `src/utils/fetcher.ts`:
  - `fetchJson()` — basic POST/GET with JSON parsing
  - `requestRaw()` — with HTTP status checking
  - `requestAnilist()` — GraphQL-specific with error handling
  - `fetchAnilistUserId()` — helper to get user ID

### 12.3 Template system
- **Two modes:**
  - **Simple (default):** User selects fields via visual checkboxes + custom names → "Generate Simple Template" button creates a `.md` file with `{{placeholder}}` frontmatter + instructions → template path auto-set to generated file
  - **Advanced:** User writes or provides a custom `.md` file with any `{{placeholder}}` syntax → set path in settings
- `TemplateService.render()` builds a **dynamic value map** from all `MediaDetails` keys (flattened), no hardcoded field list
- Unknown placeholders `{{unknown}}` are left as-is
- Array fields like `genres` → `{{genres}}` (comma-separated) and `{{genre_list}}` (YAML list)
- Date objects (`startedAt`, `completedAt`) → formatted as `YYYY-MM-DD`
- See `TEMPLATE.md` for full placeholder reference

### 12.4 Sync
- **Manual only** (command, button, startup). No background intervals.
- Two-way for AniList: modified data can be sent back
- Conflict resolution is per-field, not per-entry
- HTTP status + GraphQL errors both checked before resolving

### 12.5 File naming
- `{SanitizedTitle} - {sourceId}.md`
- Sanitize: remove `\/:*?"<>|`, trim, replace `\n` with space

---

## 13. References

- **Lorebase** (`references/obsidian-lorebase-plugin-main/`):
  - Templates (simple + advanced) — `services/integrations/templateUtils.ts`
  - Providers (steam, rawg, igdb, anilist, shikimori, howlongtobeat)
  - Steam sync — `services/SteamSyncService.ts`
  - Settings sections — `settings/sections/`

- **Library** (`references/obsidian-library-plugin-main/`):
  - ProviderRegistry — `providers/registry.ts`
  - ContentProvider interface — `providers/types.ts`
  - i18n — `i18n.ts`
  - BookAggregator — `providers/bookAggregator.ts`

- **Anilist Sync** (`references/obsidian-anilist-sync-main/`):
  - Anilist GraphQL client — `src/Logic/AnilistClient.ts`
  - Sync Manager — `src/Logic/AnilistSyncManager.ts`
  - Service Locator — `src/Base/Services.ts`

---

## 14. Versioning plan

- **0.1.0** — MVP: AniList provider, template system, add content, settings, i18n ✅
- **0.2.0** — AniList sync, personalization, custom fields ✅ (merged into 0.1)
- **0.3.0** — Field Registry + visual template customization ✅
- **0.4.0** — Multi-provider: OMDb, RAWG, Steam, books
- **0.5.0** — Library View (widgets)
- **0.6.0** — Steam sync
- **0.7.0** — Polish, tests, documentation
- **1.0.0** — Stable release

---

*This document will be updated as new decisions are made.*
