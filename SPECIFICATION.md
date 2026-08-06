# Babylon Plugin — Technical Specification

> **Version:** 0.5.0 (Planned: Preset System — Visual Note Builder)
> **Last updated:** 2026-08-04
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
  fieldMapPath: string;        // vault-relative path to {mediaType}-fields.json
}

interface SyncSettings {
  enabled: boolean;
  syncOnStartup: boolean;
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

**Current types in `src/types.ts` match the above (with additions for sync).**

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
  sync: {
    enabled: boolean;
    syncOnStartup: boolean;
  };
  noteIgnoreOverrides: Record<string, string[]>;  // sourceId → field keys to ignore
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
- `anime.ts` — AniList-specific fields with GraphQL fragments, 5 categories, ~40 fields
  - Identity (9 fields): id, idMal, title, originalTitle, title_en, title_jp, title_ro, title_ru, siteUrl
  - Info (12): year, season, seasonInt, startDate, endDate, type, description, cover, bannerImage, genres, synonyms, countryOfOrigin
  - Ratings (5): averageScore, meanScore, popularity, favourites, trending
  - Technical (14): format, status, episodes, duration, chapters, volumes, source, hashtag, updatedAt, isAdult, isLicensed, tags, studios, plus 10 advanced fields (trailer, streamingEpisodes, nextAiringEpisode, airingSchedule, trends, externalLinks, reviews, recommendations, stats, rankings)
  - Personal (9, require auth): progress, score, myStatus, advancedScores, startedAt, completedAt, notes, repeat, progressVolumes

### Initialization

`initFields()` in `src/fields/index.ts` registers all default field sets. Called from `main.ts` during `onload()`.

### Advanced fields

Fields with `advanced: true` (trailer, streamingEpisodes, nextAiringEpisode, airingSchedule, trends, externalLinks, reviews, recommendations, stats, rankings) are hidden from the field selector UI checkbox list but remain in the registry. Users enable them by adding the field key to `customFieldNames`. Their GraphQL fragments are still assembled dynamically.

### Field Map (JSON sidecar)

When generating a simple template, the system also creates a `{mediaType}-fields.json` file in the template folder. This JSON stores the mapping between canonical field keys and actual frontmatter property names, plus sync participation flags. The sync system reads this file to determine which fields to sync and where to find them in each note's frontmatter.

See section 7 below for full details.

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

## 7. Sync System (v2 — Field Map + Batch Review)

### 7.1 Architecture Overview

The sync system is redesigned around a **field map** — a JSON sidecar file that decouples sync from templates and allows user-renameable frontmatter properties.

```
SyncFlow:
  Settings (data.json)         Field Map (JSON sidecar)
      │                              │
      │  sync.enabled                │  syncFields[].key → FieldDefinition.key
      │  sync.syncOnStartup          │  syncFields[].property → frontmatter key
      │  noteIgnoreOverrides         │  syncFields[].sync → boolean
      │         │                    │
      └─────────┴────────────────────┘
                      │
              SyncEngine.syncAll()
                      │
          ┌───────────┼───────────────┐
          │           │               │
     Fetch remote  Scan vault    Read field map
     (AniList)     for notes     + ignore list
          │           │               │
          └───────────┼───────────────┘
                      │
              Compare per-field
                      │
              Changes detected?
              /              \
            Yes               No
             │                 │
     SyncReviewModal      "Up to date"
     (batch review)
             │
      User applies/cancels
             │
      Write frontmatter
```

### 7.2 Components

All located in `src/sync/`:

| File | Purpose |
|------|---------|
| `types.ts` | SyncFieldSetting, NoteSyncChange, SyncFieldChange |
| `SyncFieldMap.ts` | Read/write JSON sidecar, generate from settings |
| `NoteIgnoreStore.ts` | Per-note ignore list (data.json) |
| `SyncEngine.ts` | Core sync pipeline: collect → compare → apply |
| `ui/SyncReviewModal.ts` | Batch review modal with per-field toggles |
| `index.ts` | Re-exports |

### 7.3 Field Map (JSON sidecar)

**Location:** `{templateFolder}/{mediaType}-fields.json`
**Example:** `Templates/anime-fields.json`

```json
{
  "version": 1,
  "mediaType": "anime",
  "syncFields": [
    {
      "key": "progress",
      "property": "EpisodeWatched",
      "type": "number",
      "sync": true
    },
    {
      "key": "score",
      "property": "rating",
      "type": "number",
      "sync": true
    },
    {
      "key": "myStatus",
      "property": "status",
      "type": "string",
      "sync": true
    },
    {
      "key": "startedAt",
      "property": "startedAt",
      "type": "date",
      "sync": false
    }
  ]
}
```

**Auto-generation:** When user clicks "Generate Simple Template", the generator scans the rendered YAML frontmatter for each `{{placeholder}}`, determines what frontmatter property it landed under, and saves the mapping into `{mediaType}-fields.json`. Only `personal` fields get `sync: true` by default.

**Manual editing:** User can edit the JSON directly in their vault, or via a settings UI (future).

**No field map found:** SyncEngine falls back to defaults: all personal fields from FieldRegistry, property = field key, sync = true.

### 7.4 Property name resolution (the rename problem)

When user renames `progress: {{progress}}` → `EpisodeWatched: {{progress}}` in the template:

1. User updates the field map: edits `"property": "EpisodeWatched"`
2. SyncEngine reads the map, tries `EpisodeWatched` in frontmatter
3. If not found → fallback to `key` (`progress`)
4. If not found → case-insensitive scan of all frontmatter keys
5. When writing: writes to `property` (`EpisodeWatched`), optionally cleans up old key

**Reading priority:**
```
1. property (user-configured, e.g. "EpisodeWatched")
2. key     (canonical, e.g. "progress")
3. case-insensitive scan
```

**Writing:**
```
Always write to "property". Delete old "key" if it exists and differs from "property".
```

### 7.5 SyncEngine (`src/sync/SyncEngine.ts`)

#### `syncAll(mediaType)`

```
1. Auth check — if no token, abort
2. Load field map — read {mediaType}-fields.json OR use defaults
3. Fetch remote — getUserMediaList() from AniList → Map<sourceId, AnilistEntry>
4. Scan vault — find all * - {sourceId}.md files in mediaType folder
5. For each matching note:
   a. Extract sourceId from filename
   b. Read frontmatter via parseFrontmatter()
   c. Load per-note ignore list from data.json[noteIgnoreOverrides][sourceId]
   d. For each syncField where sync = true:
      - If field key in ignore list → skip
      - Resolve property name in frontmatter → get local value
      - Get remote value from AnilistEntry
      - If values differ → push SyncFieldChange to list
   e. If any changes → push NoteSyncChange to results
6. Return SyncResult { changes: NoteSyncChange[] }
```

#### `syncOne(file)`

Same as syncAll but for a single file. Extracts sourceId from filename, fetches a single AniList entry by sourceId, compares, returns changes.

### 7.6 SyncReviewModal (`src/sync/ui/SyncReviewModal.ts`)

```
┌─────────────────────────────────────────────────────┐
│  Sync Review — 3 notes with changes                 │
│                                                     │
│  ☐ Frieren - 154587.md                             │
│  │  ☑ progress: 8 → 12                             │
│  │  ☑ score: 7 → 8                                 │
│  │  ☐ status: watching → completed                  │
│  │  [Ignore field]                                  │
│  │                                                  │
│  ☐ Attack on Titan - 12345.md                      │
│  │  ☑ progress: 45 → 50                            │
│  │                                                  │
│  ...                                                │
│                                                     │
│  [Apply selected]  [Apply all]  [Skip all]  [Cancel]│
└─────────────────────────────────────────────────────┘
```

- Notes listed as collapsible sections (click to expand/collapse)
- Per-note checkbox selects/deselects all its fields
- Per-field checkbox toggles individual field sync
- "Ignore field" button adds field to per-note ignore list → saved to data.json
- "Apply selected" — write accepted changes to frontmatter
- "Apply all" — accept everything
- "Skip all" / "Cancel" — abort

### 7.7 NoteIgnoreStore (`src/sync/NoteIgnoreStore.ts`)

Stored in `BabylonSettings.noteIgnoreOverrides`:

```typescript
noteIgnoreOverrides: Record<string, string[]>;
// key: sourceId (from filename)
// value: field keys to skip during sync
```

Example in data.json:
```json
{
  "noteIgnoreOverrides": {
    "154587": ["notes", "score"],
    "12345": ["score"]
  }
}
```

### 7.8 One-way sync (AniList → Obsidian)

Data only flows from AniList into Obsidian. No mutations sent back to AniList. This simplifies the initial implementation and avoids accidental data loss.

### 7.9 Integration with settings

In `anilist.ts` settings section:

- **Sync enabled** toggle
- **Sync on startup** toggle
- **Field map status** — shows if `anime-fields.json` exists, path, field count
- **"Sync all"** button → triggers SyncEngine.syncAll("anime")
- **"Generate field map"** button → creates/updates the JSON sidecar from current template

### 7.10 Steam Sync (planned)

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

## 11. Sync Review (v2)

```
┌─────────────────────────────────────────────────────┐
│  Sync Review — 3 notes with changes                 │
│                                                     │
│  ☐ Frieren - 154587.md (click to expand)           │
│  │  ☑ progress: 8 → 12                             │
│  │  ☑ score: 7 → 8                                 │
│  │  ☐ status: watching → completed                  │
│  │  [x] Ignore this field forever                   │
│  │                                                  │
│  ☐ Attack on Titan - 12345.md (click to expand)     │
│  │  ☑ progress: 45 → 50                            │
│  │                                                  │
│  ...                                                │
│                                                     │
│  [Apply selected] [Apply all] [Skip all] [Cancel]   │
└─────────────────────────────────────────────────────┘
```

- **Apply selected:** Write checked fields to frontmatter
- **Apply all:** Write all changes without review
- **Skip all:** Skip all pending changes
- **Per-field checkbox:** Include/exclude individual field
- **Ignore field:** Add field to per-note ignore list (saved in data.json)

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
- **One-way** (AniList → Obsidian) only. No mutations sent to AniList.
- **Field map decouples** sync from template — field-to-property mapping stored in external JSON sidecar
- **Property name resolution** handles user-renamed frontmatter keys (fallback chain: property → key → case-insensitive)
- **Batch review** with per-file/per-field toggles
- **Per-note ignore** via data.json (sourceId → field keys)
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
- **0.4.0** — Sync v2: Field Map, batch review, per-note ignore, property mapping ✅
- **0.5.0** — Preset System (Visual Note Builder) — current plan
- **0.6.0** — Multi-provider: OMDb, RAWG, Steam, books
- **0.7.0** — Library View (widgets)
- **0.8.0** — Steam sync
- **0.9.0** — Polish, tests, documentation
- **1.0.0** — Stable release

---

## 15. Preset System (v0.5.0)

> **Status:** Implemented (core + UI) on branch `preset-system`. Replaces the manual template + field-map editing workflow with a visual **preset** system. Field map (Section 7) becomes legacy; SyncEngine keeps a fallback to it when no preset exists.

### 15.1 Goal

Users configure note metadata through a visual UI instead of hand-editing `.md` templates and JSON sidecars. A preset is the single source of truth for **how a note is built** (which fields, their names/order/formatting) and **how it syncs** (field key mapping, sync flags).

### 15.2 Design decisions (confirmed)

| Decision | Choice |
|----------|--------|
| Preset vs template responsibility | **Hybrid**: preset generates frontmatter; `.md` template provides body text; preset can override any part |
| Template aliases after rename | **Property name from preset** — one name everywhere (file, template, sync) |
| Multiple presets | **Yes**, one marked `default`; at note creation use default or let user pick |
| Formatting flags (v1) | value map, date format, number scaling, case/capitalization |
| Storage | `{templateFolder}/{mediaType}.preset.json` |
| Editor UI | Modal opened from settings |
| Migration | Start clean (no auto-import) |

### 15.3 Data model

```typescript
interface FieldFormat {
  case?: 'none' | 'lower' | 'upper' | 'capitalize' | 'title';
  valueMap?: Record<string, string>;   // "PLANNING" → "Planning"
  dateFormat?: 'YYYY-MM-DD' | 'DD.MM.YYYY' | 'YYYY/MM/DD' | 'D MMM YYYY';
  number?: {
    scaleFrom?: number;   // 100 (AniList default)
    scaleTo?: number;     // 10
    round?: number;       // decimal places, e.g. 1 → 8.6
  };
}

interface PresetField {
  id: string;              // internal unique id
  apiKey: string;          // canonical API key → FieldDefinition.key, or custom field
  property: string;        // frontmatter name in the file == template alias
  type: 'string' | 'number' | 'date' | 'boolean' | 'array' | 'object';
  order: number;           // sort position in frontmatter
  sync: boolean;           // participate in sync
  format?: FieldFormat;    // applied when writing to frontmatter AND when comparing sync
}

interface MediaPreset {
  name: string;
  isDefault: boolean;
  fields: PresetField[];   // ordered by `order`
}

interface PresetCollection {
  version: number;         // PRESET_COLLECTION_VERSION = 1
  mediaType: MediaType;
  presets: MediaPreset[];
}
```

**Defaults:** When a media type has no preset, generate one from `FieldRegistry` (all `personal` + core fields), `property = apiKey`, sensible formatting (e.g. `myStatus` case=capitalize, `startedAt`/`completedAt` dateFormat=YYYY-MM-DD), `sourceId`/`provider` appended as non-sync identity fields.

### 15.4 Formatting engine

`PresetFormatter.apply(raw, field.format): string | number | boolean | null`

Applied in order: `valueMap` → `case` → `dateFormat` → `number`. Pure, no side effects.

- **case:** transform string casing (lower/upper/capitalize/title)
- **valueMap:** exact-match lookup on the string value; no match → value unchanged
- **dateFormat:** format Date / `{year,month,day}` / ISO string into the chosen layout
- **number:** multiply by `scaleTo / scaleFrom`, round to `round` decimals; null-safe

### 15.5 Note creation flow (hybrid)

```
User picks content → provider returns MediaDetails
    → active preset resolved (default, or user picks via PresetPickerModal)
    → FRONTMATTER (generated by preset):
        for each field sorted by order:
            value = details[apiKey]
            formatted = PresetFormatter.apply(value, field.format)
            line = `${property}: ${serializeYaml(formatted)}`   // reuse existing YAML serialization
    → BODY (from .md template via PresetTemplate):
        placeholders `{{property}}` → formatted value
        arrays: `{{property}}` = comma-joined, `{{property_list}}` = YAML list
        unknown placeholders left as-is
    → combine: ---\n{frontmatter}\n---\n{body}  → app.vault.create()
```

### 15.6 Sync flow

`SyncEngine` loads the active preset instead of the field map:

```
per note:
    for each presetField where sync = true and not ignored:
        local  = readFrontmatter(property)                     // already formatted
        remote = flattenRemote(apiKey)                         // raw from API
        remoteFormatted = PresetFormatter.apply(remote, field.format)   // normalize to output form
        if not valuesEqual(local, remoteFormatted) → change
```

- Field map remains a **fallback** if no preset exists for the media type (legacy support).
- Formatting is applied to the **remote** side before comparison — the local file already holds formatted values.
- **`advancedScores`:** each sub-value is its own preset field with `apiKey = advancedScores.<Name>`. Values resolve via the provider's flat key `advancedScore_<camel>` (`detailsKeyFor()`), falling back to scanning the raw `advancedScores` object. Sync lookups use the camelized remote key (`remoteKeyFor()` → `advancedScores.<camel>`).

### 15.7 UI — PresetEditorModal

```
┌───────────────────────────────────────────────┐
│  Preset: Anime — Main   [is default]          │
│  ─────────────────────────────────────────────│
│  + Add field      [Duplicate] [Delete] [Save] │
│  ─────────────────────────────────────────────│
│  ⇅ 1. EpisodeWatched   apiKey=progress  [sync]│
│  ⇅ 2. rating           apiKey=score     [sync]│
│  ⇅ 3. status           apiKey=myStatus  [sync]│
│       ▾ formatting                            │
│         case: capitalize                       │
│         valueMap: PLANNING → Planning  [+]    │
│         date:  YYYY-MM-DD                      │
│         number: 100 → 10, round 1              │
│  ⇅ 4. story             apiKey=advancedScores  │
│  ─────────────────────────────────────────────│
```

- Each row: drag to reorder; editable `property` (frontmatter name == alias); `apiKey` select from FieldRegistry (or custom input); `sync` toggle; expandable formatting block.
- Validation: unique `property` names, non-empty, valid `apiKey`.
- Top bar: preset `name`, `isDefault` toggle, duplicate/delete, Save & Close.

### 15.8 Settings integration

Per media type, a **Presets** section:
- List existing presets (name, default badge, field count)
- Buttons per preset: Edit (opens modal), Set default, Duplicate, Delete
- "Create preset" button → generates default from FieldRegistry and opens editor
- Current Field Map section marked as legacy/deprecated (hidden behind a "Legacy" toggle)

### 15.9 Edge cases

- **Arrays** (genres, studios): YAML list in frontmatter; comma-joined alias in body
- **`advancedScores` object:** auto-expand to sub-fields (current behavior); sub-fields inherit format
- **Custom API fields** (apiKey not in FieldRegistry): type defaults to string, treated like any field
- **Empty values:** field omitted from frontmatter (or written empty) — configurable later (not in v1)
- **Preset edited mid-life:** existing notes keep old formatting until next sync; a sync pass normalizes them
- **Duplicate names:** blocked by validation

### 15.10 Versioning

- **0.5.0** — Preset System (this stage)
- Field map (`{mediaType}-fields.json`) stays read-only legacy fallback, removed in a later version.

---

*This document will be updated as new decisions are made.*
