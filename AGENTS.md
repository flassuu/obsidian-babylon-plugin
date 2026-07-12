# Babylon Plugin — Obsidian Community Plugin

## Project overview

- **Plugin ID:** `babylon`
- **Target:** Obsidian Community Plugin (TypeScript → bundled JavaScript).
- **Entry point:** `src/main.ts` compiled to `main.js` and loaded by Obsidian.
- **Required release artifacts:** `main.js`, `manifest.json`, and optional `styles.css`.
- **Description:** Universal media library plugin — track games, anime, books, movies, series with metadata from external APIs and bidirectional sync.
- **References (for patterns/code):** `../references/` folder (lorebase, library, anilist-sync plugins).
- **Specification:** See `SPECIFICATION.md` for detailed technical decisions.
- **Roadmap:** See `ROADMAP.md` for milestones.

## Architecture

```
src/
├── main.ts                  # Plugin lifecycle (minimal)
├── types.ts                 # Core types (MediaType, MediaItem, etc.)
├── constants.ts             # Constants, defaults
├── i18n.ts                  # Translation system
├── settings/
│   ├── SettingsTab.ts       # Main settings tab
│   ├── sections/            # Setting sections (general, api, media, library, sync)
│   └── defaults.ts          # DEFAULT_SETTINGS
├── providers/
│   ├── registry.ts          # ProviderRegistry
│   ├── types.ts             # ContentProvider interface
│   ├── anilist.ts
│   ├── omdb.ts
│   ├── steam.ts
│   ├── rawg.ts
│   ├── howlongtobeat.ts
│   ├── openlibrary.ts
│   └── googlebooks.ts
├── services/
│   ├── ContentService.ts    # Create/update/delete notes
│   ├── TemplateService.ts   # Template rendering
│   ├── SyncService.ts       # Base sync logic
│   ├── AnilistSyncService.ts
│   └── SteamSyncService.ts
├── ui/
│   ├── modals/
│   │   ├── AddContentModal.ts
│   │   ├── ManualModal.ts
│   │   ├── ConflictModal.ts
│   │   └── ReviewModal.ts
│   └── views/
│       └── LibraryView.ts   # Future: widget-based library view
├── utils/
│   ├── sanitize.ts
│   ├── fetcher.ts
│   └── frontmatter.ts
└── styles/
    └── library.css
```

## Before coding any feature

1. **Read SPECIFICATION.md** — understand the architecture decisions, types, data flow.
2. **Check references** — look at how similar features are implemented in lorebase/library/anilist-sync plugins.
3. **Read the relevant AGENTS.md conventions** in each reference plugin for patterns.

## Environment & tooling

- Node.js: use current LTS (Node 18+).
- **Package manager: npm**.
- **Bundler: esbuild** (`esbuild.config.mjs`).
- Types: `obsidian` type definitions.

```bash
npm install        # Install dependencies
npm run dev        # Watch mode
npm run build      # Production build
npm run lint       # ESLint
```

## Coding conventions

- TypeScript with `"strict": true`.
- **Keep `main.ts` minimal** — lifecycle only. Delegate to modules.
- **Split large files** — if >200-300 lines, break into smaller modules.
- **Clear module boundaries** — each file has a single responsibility.
- **Bundle everything** into `main.js` (no unbundled runtime deps).
- **Cross-platform** — avoid Node/Electron APIs for mobile.
- **Async/await** over promise chains; handle errors gracefully.
- **Idempotent code** — reload/unload shouldn't leak listeners.
- **Use `this.register*` helpers** for all listeners/intervals.

## Manifest rules

```json
{
  "id": "babylon",
  "name": "Babylon",
  "version": "1.0.0",
  "minAppVersion": "1.12.0",
  "description": "Universal media library plugin",
  "isDesktopOnly": false
}
```

- Never change `id` after release.
- Keep `minAppVersion` accurate.

## Security & privacy

- Default to local/offline. Network only when user explicitly adds/syncs.
- No hidden telemetry. Clear disclosure for external services.
- Never execute remote code or auto-update outside releases.
- Store API keys in plugin settings (open storage, user choice).
- Register + clean up all DOM/event listeners.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
