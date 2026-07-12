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
- [x] **Sync:**
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

### Field definitions

6 categories (extensible):
- **Core** — title, originalTitle, year, description, cover, bannerImage, genres, synonyms, countryOfOrigin, siteUrl
- **Ratings** — averageScore, meanScore, popularity, favourites
- **Technical** — format, status, episodes, duration, season, source, hashtag, updatedAt
- **Personal** — progress, score, startedAt, completedAt, notes, repeat, progressVolumes (requires auth)
- **Media** — tags, trailer, streamingEpisodes, externalLinks, studios
- **Rankings** — rankings

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
  - [ ] GitHub Actions (lint, test, build)
  - [ ] Release action (auto-attach assets)
- [ ] **Publishing** in Obsidian Community Plugins

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
