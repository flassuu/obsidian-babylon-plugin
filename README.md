# Babylon

**Babylon** is an Obsidian plugin for building a universal media library. Search, track, and organize your anime, movies, series, games, and books — all within your vault.

## Status

Early MVP. Anime via AniList works (search, add from list, sync). Other media types have basic scaffolding with providers coming soon.

## Features

### Implemented
- **AniList provider** — search anime, fetch details, add notes from templates
- **Add from AniList account** — browse and import your personal lists
- **AniList sync** — bidirectional sync of progress, scores, status (with conflict resolution)
- **OAuth flow** — simplified token-based auth with test connection showing your stats
- **Template system** — .md files with `{{placeholder}}` syntax; built-in default template
- **Custom GraphQL fields** — configure extra AniList fields (public/private) available in templates
- **i18n** — English & Russian

### In progress
- More providers (OMDb, RAWG, Steam, Google Books, OpenLibrary)
- Search & add for movies, series, games, books

### Planned
- Library view with virtual grid, filtering, stats
- Steam library import & sync
- HowLongToBeat integration

## Getting started

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

Copy `main.js`, `manifest.json`, `styles.css` to `VaultFolder/.obsidian/plugins/babylon/`.

## Documentation

- [Roadmap](ROADMAP.md)
- [Specification](SPECIFICATION.md)
- [Templates](TEMPLATE.md)
- [Development conventions](AGENTS.md)

## License

MIT
