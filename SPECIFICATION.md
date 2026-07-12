# Babylon — Technical Specification

## Architecture

```
src/
├── main.ts                    # Plugin lifecycle
├── types.ts                   # Core types (MediaType, BabylonSettings, etc.)
├── i18n.ts                    # Translation system (en/ru)
├── settings/
│   ├── SettingsTab.ts         # Settings tab layout & About section
│   ├── defaults.ts            # DEFAULT_SETTINGS
│   └── sections/
│       ├── general.ts         # Language setting
│       ├── media.ts           # Media types section (anime, movie, etc.)
│       ├── anilist.ts         # AniList provider settings & auth UI
│       └── api.ts             # API keys for external providers
├── providers/
│   ├── registry.ts            # ProviderRegistry
│   ├── types.ts               # ContentProvider interface
│   └── anilist.ts             # AniList GraphQL provider
├── services/
│   ├── ContentService.ts      # Create notes from MediaDetails
│   ├── TemplateService.ts     # Template rendering with placeholders
│   └── AnilistSyncService.ts  # Bidirectional AniList sync
├── ui/
│   └── modals/
│       ├── AddContentModal.ts # Search & select results
│       ├── AddFromListModal.ts # Import from AniList account
│       ├── ConflictModal.ts   # Sync conflict resolution
│       └── ... (ReviewModal, ManualModal)
└── utils/
    ├── fetcher.ts             # GraphQL & HTTP helpers
    ├── sanitize.ts            # HTML stripping
    └── frontmatter.ts         # YAML frontmatter parsing
```

## Data model

### BabylonSettings
Stored in `data.json` via Obsidian's settings API.

```
language: 'en' | 'ru'
apiKeys: { omdb, rawg, googleBooks, steam }
anilistAuth: {
  personalizationEnabled: boolean
  accessToken: string
  customFields: string          # backward compat
  customFieldsPublic: string    # public GraphQL fields (one per line)
  customFieldsPrivate: string   # private GraphQL fields (one per line)
}
anilistSync: {
  enabled: boolean
  syncOnStartup: boolean
  twoWaySync: boolean
}
media: Partial<Record<MediaType, MediaTypeSettings>>
```

### MediaTypeSettings
```
enabled: boolean
folder: string          # vault-relative output folder
provider: ProviderId | null
templatePath: string    # vault-relative .md template
```

## Provider system

All providers implement `ContentProvider` interface:

```typescript
interface ContentProvider {
  id: ProviderId
  mediaTypes: MediaType[]
  requiresKey: boolean
  search(query: string): Promise<SearchResult[]>
  fetchDetails(sourceId: string, raw?: unknown): Promise<MediaDetails | null>
}
```

### AniList provider
- **API**: GraphQL (`https://graphql.anilist.co`)
- **Auth**: Personal Access Token (OAuth PIN flow)
- **Client ID**: `45744`
- **Custom fields**: User-configurable public/private GraphQL fields merged into query
- **Personalization**: Enables token-based features (add from list, sync, private fields)

## Sync architecture

AniListSyncService compares local notes with AniList entries:
1. Fetch all local notes with `source_id` frontmatter
2. Fetch MediaListCollection from AniList
3. Compare status/score/progress/notes
4. On conflict: show ConflictModal for per-field resolution
5. Apply changes (write local → push to AniList)

## Template system

- Templates are `.md` files with `{{placeholder}}` syntax
- Built-in default template if none configured
- Placeholders resolved from `MediaDetails` object keys
- Custom fields from `customFieldsPublic`/`customFieldsPrivate` are also available
- See [TEMPLATE.md](TEMPLATE.md) for full reference

## OAuth flow

1. User clicks "Authorize" → opens `https://anilist.co/api/v2/oauth/authorize?client_id=45744&response_type=token`
2. User approves → redirected to `https://anilist.co/api/v2/oauth/pin` with token in URL
3. User copies token → pastes in settings
4. "Test connection" verifies token and shows account stats

## Sync design decisions

- Uses `requestAnilist()` which checks both HTTP status and GraphQL errors
- Two-step fetch for MediaListCollection: first get userId via Viewer query, then fetch list
- Conflict resolution is per-field, not per-entry
