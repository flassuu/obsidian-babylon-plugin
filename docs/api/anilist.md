# Babylon — AniList GraphQL API Reference

> **Source:** https://docs.anilist.co
> **Endpoint:** `POST https://graphql.anilist.co`
> **Auth:** none required for public queries (search + details)

---

## Media object (Anime/Manga)

### Scalar fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int!` | Media ID in AniList |
| `idMal` | `Int` | ID on MyAnimeList |
| `type` | `MediaType` | `ANIME` or `MANGA` |
| `format` | `MediaFormat` | `TV`, `TV_SHORT`, `MOVIE`, `SPECIAL`, `OVA`, `ONA`, `MUSIC`, `MANGA`, `NOVEL`, `ONE_SHOT` |
| `status` | `MediaStatus` | `FINISHED`, `RELEASING`, `NOT_YET_RELEASED`, `CANCELLED`, `HIATUS` |
| `description` | `String` | Description (HTML or markdown, with `asHtml` argument) |
| `episodes` | `Int` | Episode count (anime) |
| `duration` | `Int` | Episode length in minutes |
| `chapters` | `Int` | Chapter count (manga) |
| `volumes` | `Int` | Volume count (manga) |
| `countryOfOrigin` | `CountryCode` | Country of origin (ISO 3166-1 alpha-2) |
| `isLicensed` | `Boolean` | Licensed or doujinshi |
| `source` | `MediaSource` | `ORIGINAL`, `MANGA`, `LIGHT_NOVEL`, `VISUAL_NOVEL`, `VIDEO_GAME`, `OTHER`, `NOVEL`, `DOUJINSHI`, `ANIME`, `WEB_NOVEL`, `LIVE_ACTION`, `GAME`, `COMIC`, `MULTIMEDIA_PROJECT`, `PICTURE_BOOK` |
| `hashtag` | `String` | Official Twitter hashtag |
| `updatedAt` | `Int` | Unix timestamp of last update |
| `bannerImage` | `String` | Banner URL |
| `genres` | `[String]` | List of genres |
| `synonyms` | `[String]` | Alternative titles |
| `averageScore` | `Int` | Weighted average rating **(0-100)** |
| `meanScore` | `Int` | Arithmetic mean rating **(0-100)** |
| `popularity` | `Int` | Users with this in their list |
| `isLocked` | `Boolean` | Locked for lists/favourites |
| `trending` | `Int` | Activity over the last hour |
| `favourites` | `Int` | Users who favourited it |
| `isFavourite` | `Boolean!` | Favourite for current user |
| `isFavouriteBlocked` | `Boolean!` | Blocked from favourites |
| `isAdult` | `Boolean` | 18+ content |
| `siteUrl` | `String` | AniList page URL |
| `autoCreateForumThread` | `Boolean` | Auto-create threads on episode release |
| `isRecommendationBlocked` | `Boolean` | Blocked from recommendations |
| `isReviewBlocked` | `Boolean` | Blocked from reviews |
| `modNotes` | `String` | Moderator notes |

### Dates and seasons

| Field | Type | Description |
|-------|------|-------------|
| `startDate` | `FuzzyDate` | First release date `{year, month, day}` |
| `endDate` | `FuzzyDate` | End date `{year, month, day}` |
| `season` | `MediaSeason` | `WINTER`, `SPRING`, `SUMMER`, `FALL` |
| `seasonYear` | `Int` | Season year |
| `seasonInt` | `Int` | Year + season as number (e.g. 20243) |

### Nested objects

| Field | Type | Contains |
|-------|------|----------|
| `title` | `MediaTitle` | `romaji`, `english`, `native`, `userPreferred` (each with `stylised` argument) |
| `coverImage` | `MediaCoverImage` | `extraLarge`, `large`, `medium` (URLs) + `color` (hex #) |
| `trailer` | `MediaTrailer` | `id`, `site` (youtube/dailymotion), `thumbnail` |
| `tags` | `[MediaTag]` | `id`, `name`, `description`, `category`, `rank` (0-100), `isGeneralSpoiler`, `isMediaSpoiler`, `isAdult`, `userId` |
| `rankings` | `[MediaRank]` | `id`, `rank`, `type`, `format`, `year`, `season`, `allTime`, `context` |
| `externalLinks` | `[MediaExternalLink]` | `id`, `url`, `site`, `siteId`, `type`, `language`, `color`, `icon`, `notes`, `isDisabled` |
| `streamingEpisodes` | `[MediaStreamingEpisode]` | `title`, `thumbnail`, `url`, `site` |
| `stats` | `MediaStats` | `scoreDistribution`, `statusDistribution` |
| `nextAiringEpisode` | `AiringSchedule` | `id`, `airingAt`, `timeUntilAiring`, `episode` |
| `mediaListEntry` | `MediaList` | Current user's list entry (requires auth) |
| `trends` | `MediaTrendConnection` | Paginated daily trends |

### Connections (require pagination)

| Field | Type | max perPage | Arguments |
|-------|------|-------------|-----------|
| `relations` | `MediaConnection` | — | via `edges { relationType, node {...} }` |
| `characters` | `CharacterConnection` | 25 | `sort`, `role`, `page`, `perPage` |
| `staff` | `StaffConnection` | 25 | `sort`, `page`, `perPage` |
| `studios` | `StudioConnection` | — | `sort`, `isMain` |
| `airingSchedule` | `AiringScheduleConnection` | 25 | `notYetAired`, `page`, `perPage` |
| `reviews` | `ReviewConnection` | 25 | `limit`, `sort`, `page`, `perPage` |
| `recommendations` | `RecommendationConnection` | 25 | `sort`, `page`, `perPage` |

---

## MediaList object (user list)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int!` | List entry ID |
| `userId` | `Int!` | User ID |
| `mediaId` | `Int!` | Media ID |
| `status` | `MediaListStatus` | `CURRENT`, `PLANNING`, `COMPLETED`, `DROPPED`, `PAUSED`, `REPEATING` |
| `score` | `Float` | Score |
| `progress` | `Int` | Progress (episodes/chapters) |
| `progressVolumes` | `Int` | Volumes read |
| `repeat` | `Int` | Re-watches |
| `priority` | `Int` | Planning priority |
| `private` | `Boolean` | Entry privacy |
| `notes` | `String` | Text notes |
| `hiddenFromStatusLists` | `Boolean` | Hidden from status lists |
| `customLists` | `Json` | Custom lists (boolean map) |
| `advancedScores` | `Json` | Advanced scores |
| `startedAt` | `FuzzyDate` | Started date |
| `completedAt` | `FuzzyDate` | Completed date |
| `updatedAt` | `Int` | Last update |
| `createdAt` | `Int` | Creation date |
| `media` | `Media` | Nested media object |
| `user` | `User` | Nested user object |

---

## MediaListCollection (full user list)

| Field | Type | Description |
|-------|------|-------------|
| `lists` | `[MediaListGroup]` | Lists grouped by status + custom |
| `user` | `User` | List owner |
| `hasNextChunk` | `Boolean` | More data available |

**MediaListGroup:**
- `name` — group name ("Watching", "Completed", custom)
- `entries` — `[MediaList]`
- `isCustomList` — whether this is a custom list
- `isSplitCompletedList` — whether Completed is split into subgroups
- `status` — group status

---

## Mutations for sync

### SaveMediaListEntry (create/update entry)

| Argument | Type | Description |
|----------|------|-------------|
| `id` | `Int` | Entry ID (for updates) |
| `mediaId` | `Int` | Media ID (for creation) |
| `status` | `MediaListStatus` | Status |
| `score` | `Float` | Score in selected scoring system |
| `scoreRaw` | `Int` | Score in 100-point system |
| `progress` | `Int` | Episode/chapter progress |
| `progressVolumes` | `Int` | Volume progress |
| `repeat` | `Int` | Re-watches |
| `priority` | `Int` | Priority |
| `private` | `Boolean` | Privacy |
| `notes` | `String` | Notes |
| `hiddenFromStatusLists` | `Boolean` | Hide from status lists |
| `customLists` | `[String]` | Custom lists |
| `advancedScores` | `[Float]` | Advanced scores |
| `startedAt` | `FuzzyDateInput` | Start date |
| `completedAt` | `FuzzyDateInput` | Completion date |

### UpdateMediaListEntries (update several entries)

Same fields, plus `ids: [Int]` — bulk update.

### DeleteMediaListEntry

| Argument | Type | Description |
|----------|------|-------------|
| `id` | `Int` | Entry ID to delete |

---

## Example queries

### Search anime (no auth)

```graphql
query ($search: String) {
  Page(page: 1, perPage: 20) {
    pageInfo {
      total currentPage lastPage hasNextPage
    }
    media(search: $search, type: ANIME) {
      id
      title { romaji english native }
      coverImage { large extraLarge color }
      startDate { year month day }
      episodes
      format
      averageScore
      genres
      siteUrl
    }
  }
}
```

### Media details + full field list

```graphql
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title { romaji english native userPreferred }
    type
    format
    status
    description(asHtml: false)
    startDate { year month day }
    endDate { year month day }
    season
    seasonYear
    episodes
    duration
    countryOfOrigin
    isLicensed
    source(version: 3)
    hashtag
    trailer { id site thumbnail }
    updatedAt
    coverImage { extraLarge large medium color }
    bannerImage
    genres
    synonyms
    averageScore
    meanScore
    popularity
    favourites
    tags { id name description category rank isGeneralSpoiler isMediaSpoiler isAdult }
    rankings { id rank type format year season allTime context }
    externalLinks { id url site siteId type language color icon notes isDisabled }
    streamingEpisodes { title thumbnail url site }
    studios(isMain: true) { edges { node { id name } } }
    siteUrl
    isAdult
    nextAiringEpisode { airingAt timeUntilAiring episode }
  }
}
```

### Get user list (requires auth)

```graphql
query ($userId: Int, $userName: String, $type: MediaType) {
  MediaListCollection(userId: $userId, userName: $userName, type: $type) {
    lists {
      name
      isCustomList
      isSplitCompletedList
      status
      entries {
        id
        mediaId
        status
        score
        progress
        progressVolumes
        repeat
        priority
        private
        notes
        hiddenFromStatusLists
        customLists
        advancedScores
        startedAt { year month day }
        completedAt { year month day }
        updatedAt
        createdAt
        media {
          id
          title { romaji english native userPreferred }
          coverImage { large medium }
          format
          episodes
          averageScore
          siteUrl
        }
      }
    }
  }
}
```

### Update status/progress (requires auth)

```graphql
mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $score: Float, $notes: String) {
  SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, score: $score, notes: $notes) {
    id
    status
    progress
    score
    notes
  }
}
```

---

## Important notes

1. **`averageScore` / `meanScore`** are returned in the **0-100** range, not 0-10. Divide by 10.
2. **Access token** lives 1 year; refresh tokens are not supported.
3. **Rate limiting:** 90 requests per minute per IP.
4. **`MediaListCollection`** is limited to ~11,000 most recent entries.
5. **Custom lists must not be skipped** — a user may hide entries from standard lists.
6. For search: `Page.media(search: "...", type: ANIME)` — 20 per page limit.