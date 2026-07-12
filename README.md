# Babylon

**Babylon** is an Obsidian plugin for building a universal media library. Search, track, and organize your games, anime, books, movies, and series — all within your vault.

## Features

- Search media by title via external APIs (AniList, OMDb, Steam, RAWG, OpenLibrary, Google Books)
- Auto-fill notes with metadata: title, year, genre, cover art, rating, creator, and more
- Customizable templates — pick fields or write your own YAML with placeholders
- Sync progress, scores, and status with AniList (bidirectional)
- Import your Steam library and sync playtime
- Library view with virtual grid, filtering, and stats
- i18n: English & Russian

## Getting started

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

Copy `main.js`, `manifest.json`, `styles.css` to `VaultFolder/.obsidian/plugins/babylon/`.

## Documentation

- [ROADMAP.md](../ROADMAP.md) — milestones and timeline
- [SPECIFICATION.md](../SPECIFICATION.md) — technical architecture
- [AGENTS.md](AGENTS.md) — development conventions

## License

MIT
