# Babylon

**Babylon** is an Obsidian plugin for building a universal media library inside your vault. Search, track, and organize your anime, movies, series, games, and books with metadata from external APIs and bidirectional sync.

## Features

### Implemented

- **AniList provider** — search anime, fetch full details, and create notes from templates or presets.
- **Preset system** — a visual note builder: define which fields a note has, their names, order, formatting, and sync behavior without editing templates by hand.
- **Sync v2** — one-way AniList → Obsidian sync with a batch review modal, per-note ignore lists, and surgical frontmatter updates that preserve quoting, arrays, and comments.
- **Field map** — rename frontmatter properties freely; sync resolves them by property name, key, or case-insensitive match.
- **Add from AniList** — browse and import your personal lists in one flow.
- **OAuth flow** — simplified token-based authorization with a test connection showing your username, entry count, episodes watched, and mean score.
- **Template system** — `.md` files with `{{placeholder}}` syntax, a built-in default template, and per-media-type output folders.
- **Custom GraphQL fields** — configure extra AniList fields (basic or advanced) available in templates.
- **i18n** — English and Russian interfaces.

### In progress

- More providers (OMDb, RAWG, Steam, Google Books, OpenLibrary).
- Search and add for movies, series, games, and books.

### Planned

- Library view with a virtual grid, filtering, and stats.
- Steam library import and playtime sync.
- HowLongToBeat integration.

## Status

Early MVP. Anime via AniList works end to end (search, add from list, sync, presets). Other media types have basic scaffolding with providers coming soon.

## Install

Copy `main.js`, `manifest.json`, and `styles.css` to `VaultFolder/.obsidian/plugins/babylon/` and enable the plugin in **Settings → Community plugins**.

For detailed setup, including connecting an AniList account, see the [Getting Started](https://github.com/flassuu/obsidian-babylon-plugin/wiki/Getting-Started) wiki page.

## Usage

1. Run **Babylon: Add content** from the command palette.
2. Pick a media type (e.g. Anime) and search for a title.
3. Select a result — a note is created in the configured media folder.
4. Run **Babylon: Add from AniList** to import your personal list.
5. Run **Babylon: Sync** to pull progress, scores, and status into your notes.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
npm run lint   # eslint
```

### Project structure

```
obsidian-babylon-plugin/
├── src/
│   ├── main.ts                  # Plugin lifecycle
│   ├── types.ts                 # Core types
│   ├── i18n.ts                  # Translation system (en/ru)
│   ├── settings/                # Settings tab, sections, presets UI
│   ├── fields/                  # Field registry and definitions
│   ├── presets/                 # Preset system
│   ├── providers/               # Content providers (anilist, ...)
│   ├── services/                # Content, template, sync services
│   ├── ui/                      # Modals and views
│   └── utils/                   # Helpers (frontmatter, fetcher, ...)
├── styles.css
├── manifest.json
└── docs/
    ├── ROADMAP.md               # Development roadmap
    ├── SPECIFICATION.md         # Technical specification
    ├── TEMPLATE.md              # Template placeholder reference
    ├── BUGLOG.md                # Known bugs and fixes
    └── api/anilist.md           # AniList GraphQL API reference
```

## Documentation

- [Getting Started](https://github.com/flassuu/obsidian-babylon-plugin/wiki/Getting-Started) — install and first note
- [Fields Reference](https://github.com/flassuu/obsidian-babylon-plugin/wiki/Fields-Reference) — every AniList field and its Obsidian type
- [Changelog](https://github.com/flassuu/obsidian-babylon-plugin/wiki/Changelog) — release history
- [Roadmap](docs/ROADMAP.md)
- [Specification](docs/SPECIFICATION.md)
- [Templates](docs/TEMPLATE.md)
- [AniList API reference](docs/api/anilist.md)
- [Development conventions](AGENTS.md)

## Support

- [Discussions](https://github.com/flassuu/obsidian-babylon-plugin/discussions)
- [Issues](https://github.com/flassuu/obsidian-babylon-plugin/issues)

## License

MIT