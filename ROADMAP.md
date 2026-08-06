# Babylon Plugin — Roadmap

> **Name:** Babylon (Obsidian Babylon Plugin)
> **ID:** `babylon`
> **Goal:** Universal media library plugin — track games, anime, books, movies, series with metadata from external APIs and bidirectional sync.
> **Based on:** Reference plugins Lorebase, Library, Anilist Sync.

---

## Stage 1: Foundation (MVP) — "Seed"

**Goal:** Minimal viable product: user can add content via API search, create a note with metadata.

### Tasks
- [x] Project initialization (esbuild, TypeScript, Obsidian API)
- [x] **Project renamed** to `obsidian-babylon-plugin`, `id: babylon`
- [x] **Architecture:**
  - [x] Core types defined: `MediaType`, `BabylonSettings`, `ContentProvider`, `SearchResult`, `MediaDetails`
  - [x] Provider registry (`ProviderRegistry`)
  - [x] Modular folder structure: `providers/`, `services/`, `ui/`, `settings/`, `utils/`
- [x] **Providers (Search + Details):**
  - [x] **AniList** — anime search, detail fetch (GraphQL)
  - [ ] **OMDb** — movie/series search (stub exists, not wired up)
- [x] **UI / Commands:**
  - [x] "Add content" command → type picker → search modal → note creation
  - [x] Basic search modal (SuggestModal-based)
  - [ ] Manual entry modal (for types without a provider)
- [x] **Note creation:**
  - [x] Template system with `{{placeholder}}` — user-provided .md file
  - [x] Built-in default template for anime
  - [x] Configurable output folder per media type
  - [x] Filename format: `{SanitizedTitle} - {sourceId}.md`
- [x] **Settings tab:**
  - [x] **About** section — plugin info, author link, GitHub/Discord/Discussions/Donate buttons
  - [x] **General** — language (en/ru)
  - [x] **Media Types** — per-type: folder, template path, provider; anime also: AniList auth, sync, custom fields
  - [x] **API Keys** — storage for OMDb, Steam, RAWG, Google Books
- [x] **i18n:**
  - [x] `tr(key)` translation system with en → ru, extensible
- [x] **Documentation:**
  - [x] `TEMPLATE.md` — all available placeholders with examples
  - [x] `ROADMAP.md`, `SPECIFICATION.md` — project planning

### MVP Acceptance Criteria
1. ✅ User opens "Babylon: Add content" → picks "Anime" → searches "Attack on Titan" → sees results → selects → note created with title, year, genres, cover, rating, anilist_id, source_url.
2. ❌ Same flow for "Movie" via OMDb (not yet wired).
3. ✅ Settings save and load correctly.

---

## Stage 2: AniList Personalization & Sync

**Goal:** Connect AniList account for personalized data and bidirectional sync.

### Tasks
- [x] **Authentication:**
  - [x] OAuth PIN flow (authorize → copy token → paste)
  - [x] Token validation with account stats display
- [x] **Personalization:**
  - [x] Fetch user's anime list (Add from AniList)
  - [x] Private custom fields (progress, score, dates, notes)
- [x] **Sync (v1, replaced by v2):**
  - [x] Two-way sync: progress, score, status
  - [x] Conflict resolution modal (per-field: keep local / use remote / push to AniList)
  - [x] Sync on startup toggle
  - [x] Sync via command and ribbon
- [ ] Archive notes not found in AniList

---

## Stage 3: Templates & Customization

**Goal:** Visual field selection with grouping, template generation from selected fields, dynamic GraphQL queries (only requested fields), support for both simple and advanced template modes.

### Architecture

```
src/
├── fields/
│   ├── types.ts                 # FieldCategory, FieldDefinition
│   ├── FieldRegistry.ts         # Registry by media type + category
│   └── definitions/
│       ├── shared.ts            # Universal fields (title, year, genres...)
│       └── anime.ts             # AniList-specific fields (ratings, tags, etc.)
├── settings/
│   ├── ui/
│   │   ├── FieldSelector.ts     # Grouped visual field picker (checkboxes + custom input)
│   │   └── GenerateTemplateModal.ts  # Generate .md template from selected fields
│   └── sections/
│       └── anilist.ts           # Updated: FieldSelector replaces old textareas
└── providers/
    └── anilist.ts               # Dynamic GraphQL query from selected fields
```

### Settings changes

- **General section** — add `Template folder` field (default: `Templates/`)
- **MediaTypeSettings** — add `selectedFields: string[]`, `customFieldNames: string[]`, `templateMode: 'simple' | 'advanced'`
- **AnilistAuthSettings** — remove `customFields`, `customFieldsPublic`, `customFieldsPrivate` (migrated to new format)

### Field definitions (AniList)

5 categories:
- **Identity** — id, idMal, title, originalTitle, title_en, title_jp, title_ro, title_ru, siteUrl
- **Info** — year, season, seasonInt, startDate, endDate, type, description, cover, bannerImage, genres, synonyms, countryOfOrigin
- **Ratings** — averageScore, meanScore, popularity, favourites, trending
- **Technical** — format, status, episodes, duration, chapters, volumes, source, hashtag, updatedAt, isAdult, isLicensed, tags, studios
- **Personal** — progress, score, myStatus, advancedScores, startedAt, completedAt, notes, repeat, progressVolumes (requires auth)

Complex fields (trailer, streamingEpisodes, nextAiringEpisode, airingSchedule, trends, externalLinks, reviews, recommendations, stats, rankings) are marked `advanced: true` — hidden from the checkbox UI, accessible via custom fields.

Each field definition includes a `graphql` fragment for dynamic query assembly.

### FieldSelector UI (in settings)

Collapsible category groups with checkboxes + inline custom field text input. Personal fields disabled when no token.

### GenerateTemplateModal

- File name: `{mediaType}-template.md` (editable)
- Save in: template folder from settings (editable via folder picker)
- Comment language: English / Russian dropdown
- Generates `.md` file with YAML frontmatter (`{{placeholder}}` per selected field) + instruction block at bottom
- After generation, templatePath is auto-set to the generated file

### GraphQL optimization

AniList provider builds query dynamically:
- Always: id, title, coverImage, seasonYear, format, episodes, genres, description, siteUrl, status
- Plus: GraphQL fragments for each selected field + custom field names
- Only adds `mediaListEntry { }` if personal fields selected + token present

### Migration

On plugin load, if old `customFieldsPublic` / `customFieldsPrivate` exist in settings:
- Parse line by line, match against FieldRegistry keys → populate `selectedFields`
- Unmatched lines → populate `customFieldNames`
- Remove old fields from `anilistAuth`
- Set `templateMode: 'simple'`

### Tasks
- [x] **Template folder setting** — add `templateFolder` to settings, General section UI
- [x] **Field types + definitions:**
  - [x] `src/fields/types.ts` — FieldCategory, FieldDefinition interfaces
  - [x] `src/fields/FieldRegistry.ts` — registry class
  - [x] `src/fields/definitions/shared.ts` — universal fields
  - [x] `src/fields/definitions/anime.ts` — AniList fields (all 6 categories)
- [x] **Settings model update** — `MediaTypeSettings` gains `selectedFields`, `customFieldNames`, `templateMode`
- [x] **Defaults + migration** — new defaults, auto-migration when loading old data
- [x] **FieldSelector UI** — collapsible groups, checkboxes, custom field input, disabled personal when no token
- [x] **GenerateTemplateModal** — filename, folder, language, generate action
- [x] **Update anime settings section** — replace old textareas with FieldSelector + Generate button
- [x] **TemplateService** — dynamic value map (iterates all MediaDetails keys)
- [x] **AnilistProvider** — dynamic GraphQL query from selected fields + custom fields
- [x] **Update SPECIFICATION.md** — reflect new architecture

---

## Stage 3.5: Sync v2 — Field Map + Batch Review

**Goal:** Fully rework sync around a field map JSON sidecar that decouples sync from templates, allows user-renameable frontmatter properties, per-note field ignore, and batch review with per-field control.

### Tasks
- [x] **sync/types.ts** — SyncFieldSetting, NoteSyncChange, SyncFieldChange, SyncResult
- [x] **SyncFieldMap.ts** — Read/write {mediaType}-fields.json, generate from template/selection
- [x] **NoteIgnoreStore.ts** — Per-note ignore list in data.json (sourceId → fieldKeys[])
- [x] **SyncEngine.ts** — syncAll() / syncOne(): fetch remote → scan vault → compare per-field → return changes
- [x] **SyncReviewModal** — Batch review: collapsible notes, per-field checkboxes, apply/skip/ignore
- [x] **Settings integration** — Replace old sync section, add field map status + generate button
- [x] **Replace AnilistSyncService** — Remove old two-way sync, wire SyncEngine
- [x] **Property name resolution** — Read priority: property → key → case-insensitive; write to property
- [x] **One-way only** — AniList → Obsidian (no mutations)
- [x] **Field Map Editor modal** — visual editing of {mediaType}-fields.json
- [x] **Clear per-note ignores** — settings button to reset noteIgnoreOverrides
- [x] **Debug logging** — per-field comparison logs for diagnosing sync issues

> **Status:** DONE (verified Aug 2026). Sync v2 detects all enabled fields. Known solved issues: advanced-score key normalization (camelCase), Date object coercion, per-note ignore list silently blocking fields (now clearable from settings).

---

## Stage 3.7: Preset System — Visual Note Builder (NEXT)

**Goal:** Replace manual template + field-map editing with a **preset system** — a single JSON sidecar per media type that is the source of truth for how notes are built and synced. Users configure fields (names, order, formatting) through a visual UI instead of editing templates/JSON by hand.

**Design decisions (confirmed with user, Aug 2026):**
- **Hybrid:** Preset generates the frontmatter block; the `.md` template still provides the body text. Preset can override any part.
- **One name everywhere:** Template aliases use the preset's `property` name. Renaming a field in the preset changes the alias used in templates.
- **Multiple presets per media type**, one marked as `default`. At note creation: use default, or let user pick.
- **Formatting flags (v1):** value map (PLANNING→Planning), date format, number scaling (100→10), case/capitalization.
- **Storage:** `{templateFolder}/{mediaType}.preset.json` (JSON files in vault).
- **UI:** Preset editor as a modal opened from settings.
- **Migration:** start clean (new system, no auto-import of old template/field-map).

### Architecture

```
src/presets/
├── types.ts               # PresetField, FieldFormat, MediaPreset
├── PresetStore.ts         # CRUD preset JSON files in vault, default resolution
├── PresetFieldFactory.ts  # Build default preset from FieldRegistry
├── PresetFormatter.ts     # Apply formatting flags to a raw value
├── PresetFrontmatter.ts   # Generate frontmatter block from preset + data
├── PresetTemplate.ts      # Resolve template body via preset aliases
└── ui/
    ├── PresetEditorModal.ts  # Visual field editor (order, names, flags)
    └── PresetPickerModal.ts  # Choose preset at note creation
```

### Tasks

- [x] **presets/types.ts** — `PresetField`, `FieldFormat`, `MediaPreset`, versioning
- [x] **PresetStore.ts** — load/save/list/delete presets in vault; resolve active default; validation (unique property names, non-empty)
- [x] **PresetFieldFactory.ts** — generate default preset from FieldRegistry (personal + core fields, sensible formatting defaults)
- [x] **PresetFormatter.ts** — formatting engine: case, valueMap, dateFormat, number scale (pure function)
- [x] **PresetFrontmatter.ts** — build ordered frontmatter YAML from preset + MediaDetails (reuse surgical YAML serialization utils)
- [x] **PresetTemplate.ts** — render template body: `{{property}}` → formatted value, `{{property_list}}` for arrays; unknown placeholders left as-is
- [x] **TemplateService integration** — hybrid render in `ContentService.createNote()` (frontmatter from preset, body from template via `renderPresetBody`); `TemplateService` stays as legacy fallback
- [x] **ContentService integration** — `createNote()` resolves active preset (default → first → picker), builds frontmatter + body, combines
- [x] **PresetPickerModal** — choose preset at creation when multiple exist and none default
- [x] **SyncEngine integration** — replace field map with active preset (`fields` where `sync=true`); keep field-map fallback for legacy
- [x] **Sync + formatting** — apply field format to remote value before comparison (local is already formatted); advancedScores flattening via `detailsKeyFor`
- [x] **PresetEditorModal** — ordered editable field list, property names, apiKey selection, sync toggles, format flags UI, preset meta (name/default/duplicate/delete)
- [x] **Settings section** — preset list per media type: create, duplicate, delete, set default, open editor (+ legacy template/field-map under `<details>`)
- [x] **GenerateTemplateModal** — body-only mode for presets (aliases = preset `property` names)
- [x] **i18n** — all new UI strings (en/ru)
- [x] **Edge cases** — advancedScores (object/sub-fields), arrays (genres), custom API fields, empty values (verified via headless harness)
- [x] **Docs** — update TEMPLATE.md, SPECIFICATION.md, ROADMAP.md
- [ ] **Runtime test in Obsidian** — create note with a preset, run sync (rename + format), verify review modal diffs

### Full TZ (data model, flows, UI spec)

See `SPECIFICATION.md → Section 15: Preset System`.

---

## Stage 4: Multi-Provider Search

**Goal:** Add game and book support.

### Tasks
- [ ] **Game providers:**
  - [ ] **RAWG** — game search, details (API Key)
  - [ ] **Steam Store** — search + details (no key)
  - [ ] **HowLongToBeat** — playtime (fuzzy match)
- [ ] **Book providers:**
  - [ ] **OpenLibrary** — book search, details (no key)
  - [ ] **Google Books** — book search, details (API Key)
  - [ ] **BookAggregator** — combined OpenLibrary + Google Books results
- [ ] **New MediaTypes:** `game`, `book` (scaffolding done, providers pending)
- [ ] Provider-agnostic search modal

---

## Stage 5: Steam Sync

**Goal:** Import Steam library and sync playtime.

### Tasks
- [ ] **Steam Sync:**
  - [ ] Get owned games (Steam Web API — GetOwnedGames)
  - [ ] Get wishlist (IWishlistService + HTML scraping fallback)
  - [ ] Enrich: playtime, first/last played, genres via store API
- [ ] **Import:**
  - [ ] Review modal — select games to import
  - [ ] Duplicate modes: skip / update / ask
- [ ] **Playtime sync:**
  - [ ] Update playtime in frontmatter on startup or by command
  - [ ] Game status set manually (not synced from Steam)
- [ ] **Achievements:** noted for future

---

## Stage 6: Library View (Widgets)

**Goal:** Visual library display via embeddable widgets in `.md` files.

### Tasks
- [ ] **Concept:** `Content.md` (or any name) contains special markup blocks rendered as:
  - Card grid (Games, Anime, etc.)
  - Statistics (top genres, hours, progress)
- [ ] **Widget parser:** Syntax like ````babylon-widget type=anime filter=status:completed````
- [ ] **Rendering:** Render blocks as HTML in Live Preview / Reading mode (`MarkdownPostProcessor`)
- [ ] **Cards:**
  - [ ] Virtual scroll for 1000+ items
  - [ ] Context menu (right-click): status, rating, favorite, delete, open note
  - [ ] Filters, sorting, search
- [ ] **Statistics:** aggregate data widgets

---

## Stage 7: Polish, Tests, Publishing

**Goal:** Stable release in Obsidian Community Plugins.

### Tasks
- [ ] **Testing:**
  - [ ] Unit tests (vitest): providers, templates, utilities
  - [ ] Integration tests with mocked APIs
- [ ] **i18n:** Additional language support
- [ ] **Performance:**
  - [ ] Lazy initialization
  - [ ] List virtualization
  - [ ] Debounce/throttle
- [ ] **Documentation:**
  - [ ] README with screenshots, API key setup guides
- [ ] **CI/CD:**
  - [x] GitHub Actions (lint, build)
  - [ ] Release action (auto-attach assets)
- [ ] **Publishing** in Obsidian Community Plugins
- [x] **Beta release** v0.1.0-beta.1 on GitHub

---

## Future updates (Post-release)

- [ ] **Providers:** IGDB, Shikimori, Comic Vine, Deezer/Spotify
- [ ] **MyAnimeList** sync
- [ ] **Steam achievements** sync
- [ ] **Custom content types** (user-defined)
- [ ] **AI tagging** (auto genres/tags)
- [ ] **Web widget** for public library
- [ ] **Advanced analytics** (charts, trends)
- [ ] **Plugin ecosystem** (API for third-party plugins)
- [ ] **Share cards** (generate and share content card)

---

## Project structure

```
obsidian-babylon-plugin/
├── src/
│   ├── main.ts                    # Entry point, lifecycle
│   ├── types.ts                   # Core types
│   ├── i18n.ts                    # Translation system
│   ├── settings/
│   │   ├── SettingsTab.ts         # Main settings tab
│   │   ├── sections/              # Settings sections
│   │   └── defaults.ts            # DEFAULT_SETTINGS
│   ├── providers/
│   │   ├── registry.ts            # ProviderRegistry
│   │   ├── types.ts               # ContentProvider interface
│   │   └── anilist.ts             # AniList (GraphQL)
│   ├── services/
│   │   ├── ContentService.ts      # Create/update/delete notes
│   │   ├── TemplateService.ts     # Template rendering
│   │   ├── AnilistSyncService.ts  # AniList sync
│   │   └── SyncService.ts         # Base sync logic
│   ├── ui/
│   │   ├── modals/
│   │   │   ├── AddContentModal.ts # Search + add
│   │   │   ├── AddFromListModal.ts # Import from AniList
│   │   │   ├── ConflictModal.ts   # Sync conflict resolution
│   │   │   └── ReviewModal.ts     # Import review
│   │   └── views/
│   │       └── LibraryView.ts     # (future) Widgets/view
│   ├── utils/
│   │   ├── sanitize.ts            # File name & HTML sanitization
│   │   ├── fetcher.ts             # HTTP client (requestUrl)
│   │   └── frontmatter.ts         # Frontmatter parsing/generation
├── manifest.json
├── styles.css
├── README.md
├── ROADMAP.md
├── SPECIFICATION.md
├── TEMPLATE.md
└── AGENTS.md
```

---

_This roadmap will be updated as the project evolves. Each stage may be refined after the previous one is complete._
