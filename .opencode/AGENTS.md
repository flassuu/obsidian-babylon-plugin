# Babylon Plugin — AI Agent Instructions

## Project overview

- **Plugin ID:** `babylon`
- **Target:** Obsidian Community Plugin (TypeScript → bundled JavaScript).
- **Entry point:** `src/main.ts` compiled to `main.js`.
- **Required release artifacts:** `main.js`, `manifest.json`, `styles.css`.
- **Description:** Universal media library plugin — track games, anime, books, movies, series with metadata from external APIs and bidirectional sync.
- **References (for patterns):** `../references/` folder (lorebase, library, anilist-sync plugins).
- **Specification:** `docs/SPECIFICATION.md`
- **Roadmap:** `docs/ROADMAP.md`
- **Bug log (read before coding, append after fixing):** `.opencode/BUGLOG.md`

## Agent behavior rules

1. **Chat language:** The user and I communicate in Russian. All UI text in the plugin is English/Russian via i18n.
   **Russian UI tone:** always polite/formal, address the user as «Вы» — use plural/formal imperative forms («Нажмите», «Вставьте», «Скопируйте», «Выберите»), never informal «ты»-forms («Нажми», «Вставь», «Скопируй»).
2. **Never commit or push** unless the user explicitly asks "закомить" / "запуш" / "commit" / "push".
3. **Always run `npm run build && npm run lint`** after making any code changes. Fix all errors before reporting back.
4. **Read relevant files first** before editing — understand the current code style and patterns.
5. **Write comments in code** — in plain English, lowercase, human-readable (like "// fetch user id first, then get the list").
6. **Keep `main.ts` minimal** — lifecycle only. Delegate to modules.
7. **Split large files** (>200-300 lines) into smaller modules.
8. **Cross-platform** — avoid Node/Electron APIs for mobile.
9. **Async/await** over promise chains; handle errors gracefully.
10. **Idempotent code** — reload/unload should not leak listeners. Use `this.register*` helpers.
11. **Lucide icons only** — use `setIcon()` from 'obsidian' for all icons. Never use emoji or raw SVG in UI (Discord button is the one exception — outline SVG required).
12. **Always read `.opencode/BUGLOG.md` before coding** — keep known bugs, their root causes, and solutions fresh; append new fixed bugs with the same symptom/root-cause/solution structure.

## Before coding any feature

1. Read `docs/SPECIFICATION.md` — architecture decisions, types, data flow.
2. Check `docs/ROADMAP.md` — current stage and planned tasks.
3. Read `.opencode/BUGLOG.md` — known bugs and past mistakes to avoid repeating.
4. **Look in `../references/`** for implementation patterns (see cheatsheet below).
5. Read relevant source files to understand existing conventions.

## Environment & tooling

- Node.js 18+, npm.
- `npm run dev` — watch mode
- `npm run build` — production build (tsc + esbuild). After every code change, run `npm run build && npm run lint` before reporting back.
- `npm run lint` — ESLint (fix errors, warnings are OK if pre-existing)
- **Build output** (`main.js`, `styles.css`, `manifest.json`) is symlinked into the Obsidian vault's `.obsidian/plugins/babylon/` folder.
- **Hot Reload** plugin installed — Obsidian automatically reloads the plugin when `main.js` changes. No manual reload needed.
- **Git:** only commit and push when the user explicitly asks ("закомить", "запуш", "commit", "push").

## References cheatsheet

Three reference plugins live in `../references/`. Here's what each one is useful for:

### `obsidian-anilist-sync-main/` — simplest AniList sync example
- **AnilistClient.ts** — GraphQL queries for MediaListCollection, User lookup. Our `fetcher.ts` already does this, but good for comparison.
- **AnilistSyncManager.ts** — sync algorithm: fetch remote → scan local files → diff → create/update/archive. Clean two-pass pattern (update existing, then create new).
- **NoteHelpers.ts** — how to read/write frontmatter + body without Obsidian's `processFrontMatter()` (parses `---` manually, preserves body below).
- **Utils.ts** — `tryExtractIdFromFilename()` — fallback ID extraction from filename via regex.
- **Logger.ts** — auto-classname logging via stack trace (nice but optional).
- **Service Locator pattern** (`Services.ts`) — global static accessors for plugin/app/settings.
- ⚠️ This plugin is read-only (no OAuth, no token) — only public data by username. Our Babylon is more advanced.

### `obsidian-lorebase-plugin-main/` — most feature-rich, the gold standard
- **providers/ (anilist.ts, steam.ts, rawg.ts, igdb.ts, shikimori.ts, howlongtobeat.ts)** — full implementation of each provider with search + details. Our main reference for writing new providers.
  - `common.ts` — null-safe JSON traversal helpers (`getString()`, `getArray()`, etc.) — essential for API safety.
  - `anilist.ts` — BFS over related media graph to build anime parts (seasons/movies/ovas). Also has `getAnilistRelatedParts()`.
  - `steam.ts` — no-key search via `store.steampowered.com/api/storesearch`.
  - `howlongtobeat.ts` — scraping `howlongtobeat.com/api/bleed` with session init, roman numeral conversion, fuzzy match scoring.
- **templateUtils.ts** — Simple + Advanced template system. `renderTemplate(template, values)` replaces `{{VALUE:FieldName}}`. `buildSimpleTemplate(fields)` auto-generates YAML. Drag-to-reorder field UI.
- **SteamSyncService.ts** — full Steam import: owned games + wishlist (multi-fallback: API → JSON → HTML), parallel worker pool (concurrency=4), duplicate modes, playtime sync.
- **LibraryView.ts** — virtual grid library view (1326 lines). Card rendering, filtering, sorting, context menus, stats.
- **VirtualGrid.ts** — virtual scroll engine (172 lines). Only renders visible cards + buffer.
- **GameCard.ts** — card component with lazy image loading, status/rating badges, hover overlay.
- **filtering.ts** — generic `filterAndSortMedia<T>()` engine — reusable filter/sort pipeline.
- **SettingsTab.ts** — section-navigation pattern with sidebar. `settings/sections/` folder with standalone renderer functions.
- **SettingsTab.ts** — section-navigation pattern with sidebar, scroll-synced active states.
- **MetadataService.ts** — image URL resolution (`getImageUrl` handles http://, wikilinks, dataview links, vault paths).
- **localization/index.ts** — 1010-line i18n file with full en/ru and type-safe translation keys.
- **types/index.ts** — 460 lines — comprehensive type definitions including overlay layout, badge positioning, filter options.
- **ParticleService.ts** — experimental particle effects for card backgrounds.

### `obsidian-library-plugin-main/` — lightweight, good for provider patterns
- **ProviderRegistry** — minimal registry, one provider per content type.
- **BookAggregator** — meta-provider that wraps Google Books + OpenLibrary, parallel search, routes fetch back via `__pid` marker. Reference for building composite providers.
- **anime.ts (AniList provider)** — simple GraphQL search + detail. Good baseline for our own provider.
- **omdb.ts** — OMDb REST search + details. Key reference when we wire up OMDb.
- **Lazy API key via thunk** — provider constructor takes `() => string` instead of raw key, ensuring current value on each call.
- **Debounced search in modal** — `AddContentModal` pattern with 300ms debounce + in-memory cache.
- **Optimistic fetch** — skip re-fetch when raw search result already has detail data (`raw` parameter).
- **Non-destructive metadata refresh** — `tryRefresh()` only fills empty fields, never overwrites user edits.
- **Graph link sync guard** — `syncingLinks` Set prevents infinite loops from event cascade.
- **Sharing cards** — `share.ts` generates 1200×630 PNG cards via Canvas API.

## Architecture

```
src/
├── main.ts                  # Plugin lifecycle
├── types.ts                 # Core types
├── i18n.ts                  # Translation system (en/ru)
├── settings/
│   ├── SettingsTab.ts       # Main settings tab
│   ├── sections/            # Settings sections
│   └── defaults.ts          # DEFAULT_SETTINGS
├── providers/
│   ├── registry.ts          # ProviderRegistry
│   ├── types.ts             # ContentProvider interface
│   └── anilist.ts           # AniList (GraphQL)
├── services/
│   ├── ContentService.ts    # Create/update/delete notes
│   ├── TemplateService.ts   # Template rendering
│   ├── AnilistSyncService.ts
│   └── SyncService.ts       # Base sync logic
├── ui/
│   └── modals/
│       ├── AddContentModal.ts
│       ├── AddFromListModal.ts
│       ├── ConflictModal.ts
│       └── ReviewModal.ts
├── utils/
│   ├── sanitize.ts
│   ├── fetcher.ts
│   └── frontmatter.ts
└── styles.css
```

## Key conventions

- TypeScript with `"strict": true`.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Settings stored in `data.json` via `loadData()`/`saveData()`.
- Use `Setting` component for settings UI, avoid manual HTML headings.
- Lucide icons via `setIcon()` from 'obsidian'.
- GraphQL via `requestAnilist()` in `fetcher.ts`.
- Template placeholders: `{{fieldName}}` syntax.
- Filename format: `{SanitizedTitle} - {sourceId}.md`

## Standards & compliance

### Manifest (`manifest.json`)
- Must include `id`, `name`, `version` (SemVer), `minAppVersion`, `description`, `isDesktopOnly`; optional `author`, `authorUrl`, `fundingUrl`.
- Never change `id` after release; keep `minAppVersion` accurate when using newer APIs.
- Bump `version` and update `versions.json` on release; tag GitHub releases to match exactly.

### Security & privacy
- Default to local/offline operation; only make network requests essential to a feature.
- No hidden telemetry; optional analytics require explicit opt-in and documentation.
- Never execute remote code or auto-update plugin code outside of normal releases.
- Read/write only what's necessary inside the vault; disclose external services and data sent.
- Store secrets (tokens/keys) only in plugin settings (`data.json`), never in notes or logs.

### Performance
- Keep startup light; defer heavy work and use lazy initialization.
- Debounce/throttle expensive operations (especially file-system event handlers).
- Batch disk access; avoid excessive vault scans.
- Avoid Node/Electron APIs for mobile compatibility; set `isDesktopOnly` accordingly.

### UX & copy
- Sentence case for headings, buttons, and titles; action-oriented imperatives for steps.
- Keep in-app strings short, consistent, free of jargon; bold literal UI labels.
- Arrow notation for navigation: **Settings → Community plugins**.

### Troubleshooting (build/runtime)
- Plugin not loading: confirm `main.js`, `manifest.json`, `styles.css` at the top level of the vault plugin folder; run `npm run build`.
- Commands missing: verify `addCommand` runs after `onload` with unique IDs.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and UI re-renders after changes.
