# Roadmap

## v0.1 — MVP (current)

- [x] Plugin scaffold (esbuild, Obsidian types, CI)
- [x] AniList provider — search & fetch details
- [x] Template system with `{{placeholder}}` rendering
- [x] Settings UI: About, General (language), Media types
- [x] Anime settings: provider, personalization, OAuth token, sync
- [x] Add content flow (search → pick → create note)
- [x] Add from AniList account (browse personal lists)
- [x] AniList bidirectional sync with conflict resolution
- [x] i18n (en/ru)
- [x] Custom GraphQL fields (public/private) configurable in settings

### v0.2 — Multi-provider search

- [ ] OMDb provider (movies)
- [ ] RAWG provider (games)
- [ ] Steam provider (games, library import)
- [ ] Google Books provider
- [ ] OpenLibrary provider
- [ ] Provider-agnostic search modal
- [ ] Auto-detect media type from search results

### v0.3 — Library management

- [ ] Library view with virtual grid
- [ ] Filtering by type, status, genre, rating
- [ ] Stats dashboard (total titles, hours watched, etc.)
- [ ] Manual note creation (no provider)
- [ ] Bulk import / export

### v0.4 — Sync & collaboration

- [ ] Steam sync
- [ ] HowLongToBeat integration
- [ ] Sync scheduling & notifications
- [ ] Multi-profile support

### Backlog

- [ ] Custom provider API (user-defined GraphQL/REST)
- [ ] Obsidian mobile support
- [ ] Plugin API for third-party providers
- [ ] Advanced template filters & conditionals
- [ ] Cover image caching
- [ ] Reading list / watch later
