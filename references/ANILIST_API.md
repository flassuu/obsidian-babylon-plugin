# AniList GraphQL API Reference

> Источник: https://docs.anilist.co
> Endpoint: `POST https://graphql.anilist.co`
> Авторизация: не требуется для публичных запросов (search + details)

---

## Объект Media (Anime/Manga)

### Скалярные поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `Int!` | ID медиа в AniList |
| `idMal` | `Int` | ID на MyAnimeList |
| `type` | `MediaType` | `ANIME` или `MANGA` |
| `format` | `MediaFormat` | Формат: `TV`, `TV_SHORT`, `MOVIE`, `SPECIAL`, `OVA`, `ONA`, `MUSIC`, `MANGA`, `NOVEL`, `ONE_SHOT` |
| `status` | `MediaStatus` | Статус релиза: `FINISHED`, `RELEASING`, `NOT_YET_RELEASED`, `CANCELLED`, `HIATUS` |
| `description` | `String` | Описание (HTML или markdown, с аргументом `asHtml`) |
| `episodes` | `Int` | Количество эпизодов (для аниме) |
| `duration` | `Int` | Длительность эпизода в минутах |
| `chapters` | `Int` | Количество глав (для манги) |
| `volumes` | `Int` | Количество томов (для манги) |
| `countryOfOrigin` | `CountryCode` | Страна производства (ISO 3166-1 alpha-2) |
| `isLicensed` | `Boolean` | Лицензировано или додзинси |
| `source` | `MediaSource` | Источник: `ORIGINAL`, `MANGA`, `LIGHT_NOVEL`, `VISUAL_NOVEL`, `VIDEO_GAME`, `OTHER`, `NOVEL`, `DOUJINSHI`, `ANIME`, `WEB_NOVEL`, `LIVE_ACTION`, `GAME`, `COMIC`, `MULTIMEDIA_PROJECT`, `PICTURE_BOOK` |
| `hashtag` | `String` | Официальный Twitter хэштег |
| `updatedAt` | `Int` | Unix timestamp последнего обновления |
| `bannerImage` | `String` | URL баннера |
| `genres` | `[String]` | Список жанров |
| `synonyms` | `[String]` | Альтернативные названия |
| `averageScore` | `Int` | Средневзвешенный рейтинг **(0-100)** |
| `meanScore` | `Int` | Среднее арифметическое рейтинга **(0-100)** |
| `popularity` | `Int` | Число пользователей, у кого в списке |
| `isLocked` | `Boolean` | Заблокировано для списков/избранного |
| `trending` | `Int` | Активность за последний час |
| `favourites` | `Int` | Число добавивших в избранное |
| `isFavourite` | `Boolean!` | В избранном у тек. пользователя |
| `isFavouriteBlocked` | `Boolean!` | Заблокировано для избранного |
| `isAdult` | `Boolean` | 18+ контент |
| `siteUrl` | `String` | Ссылка на страницу на AniList |
| `autoCreateForumThread` | `Boolean` | Авто-создание тредов при выходе эпизода |
| `isRecommendationBlocked` | `Boolean` | Заблокировано для рекомендаций |
| `isReviewBlocked` | `Boolean` | Заблокировано для рецензий |
| `modNotes` | `String` | Заметки модераторов |

### Даты и сезоны

| Поле | Тип | Описание |
|------|-----|----------|
| `startDate` | `FuzzyDate` | Дата первого релиза `{year, month, day}` |
| `endDate` | `FuzzyDate` | Дата завершения `{year, month, day}` |
| `season` | `MediaSeason` | Сезон: `WINTER`, `SPRING`, `SUMMER`, `FALL` |
| `seasonYear` | `Int` | Год сезона |
| `seasonInt` | `Int` | Год + сезон числом (напр. 20243) |

### Вложенные объекты

| Поле | Тип | Что внутри |
|------|-----|------------|
| `title` | `MediaTitle` | `romaji`, `english`, `native`, `userPreferred` (каждое с аргументом `stylised`) |
| `coverImage` | `MediaCoverImage` | `extraLarge`, `large`, `medium` (URL) + `color` (hex #) |
| `trailer` | `MediaTrailer` | `id`, `site` (youtube/dailymotion), `thumbnail` |
| `tags` | `[MediaTag]` | `id`, `name`, `description`, `category`, `rank` (0-100), `isGeneralSpoiler`, `isMediaSpoiler`, `isAdult`, `userId` |
| `rankings` | `[MediaRank]` | `id`, `rank`, `type`, `format`, `year`, `season`, `allTime`, `context` |
| `externalLinks` | `[MediaExternalLink]` | `id`, `url`, `site`, `siteId`, `type`, `language`, `color`, `icon`, `notes`, `isDisabled` |
| `streamingEpisodes` | `[MediaStreamingEpisode]` | `title`, `thumbnail`, `url`, `site` |
| `stats` | `MediaStats` | `scoreDistribution`, `statusDistribution` |
| `nextAiringEpisode` | `AiringSchedule` | `id`, `airingAt`, `timeUntilAiring`, `episode` |
| `mediaListEntry` | `MediaList` | Запись в списке текущего пользователя (требует auth) |
| `trends` | `MediaTrendConnection` | Пагинированные дневные тренды |

### Связи (connections — требуют пагинацию)

| Поле | Тип | max perPage | Аргументы |
|------|-----|-------------|-----------|
| `relations` | `MediaConnection` | — | через `edges { relationType, node {...} }` |
| `characters` | `CharacterConnection` | 25 | `sort`, `role`, `page`, `perPage` |
| `staff` | `StaffConnection` | 25 | `sort`, `page`, `perPage` |
| `studios` | `StudioConnection` | — | `sort`, `isMain` |
| `airingSchedule` | `AiringScheduleConnection` | 25 | `notYetAired`, `page`, `perPage` |
| `reviews` | `ReviewConnection` | 25 | `limit`, `sort`, `page`, `perPage` |
| `recommendations` | `RecommendationConnection` | 25 | `sort`, `page`, `perPage` |

---

## Объект MediaList (список пользователя)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `Int!` | ID записи в списке |
| `userId` | `Int!` | ID пользователя |
| `mediaId` | `Int!` | ID медиа |
| `status` | `MediaListStatus` | `CURRENT`, `PLANNING`, `COMPLETED`, `DROPPED`, `PAUSED`, `REPEATING` |
| `score` | `Float` | Оценка |
| `progress` | `Int` | Прогресс (эпизодов/глав) |
| `progressVolumes` | `Int` | Прочитано томов |
| `repeat` | `Int` | Пересмотров |
| `priority` | `Int` | Приоритет планирования |
| `private` | `Boolean` | Приватность записи |
| `notes` | `String` | Текстовые заметки |
| `hiddenFromStatusLists` | `Boolean` | Скрыто из списков |
| `customLists` | `Json` | Кастомные списки (map boolean) |
| `advancedScores` | `Json` | Расширенные оценки |
| `startedAt` | `FuzzyDate` | Когда начал |
| `completedAt` | `FuzzyDate` | Когда закончил |
| `updatedAt` | `Int` | Последнее обновление |
| `createdAt` | `Int` | Дата создания |
| `media` | `Media` | Объект медиа (вложенный) |
| `user` | `User` | Пользователь (вложенный) |

---

## MediaListCollection (полный список пользователя)

| Поле | Тип | Описание |
|------|-----|----------|
| `lists` | `[MediaListGroup]` | Группированные списки (по статусу + кастомные) |
| `user` | `User` | Владелец списка |
| `hasNextChunk` | `Boolean` | Есть ли ещё данные |

**MediaListGroup:**
- `name` — название группы ("Watching", "Completed", кастомные)
- `entries` — `[MediaList]`
- `isCustomList` — кастомный ли это список
- `isSplitCompletedList` — разделён ли Completed на подгруппы
- `status` — статус группы

---

## Мутации для синхронизации

### SaveMediaListEntry (создать/обновить запись)

| Аргумент | Тип | Описание |
|----------|-----|----------|
| `id` | `Int` | ID записи (для обновления) |
| `mediaId` | `Int` | ID медиа (для создания) |
| `status` | `MediaListStatus` | Статус |
| `score` | `Float` | Оценка в избранной системе |
| `scoreRaw` | `Int` | Оценка в 100-балльной системе |
| `progress` | `Int` | Прогресс эпизодов/глав |
| `progressVolumes` | `Int` | Прогресс томов |
| `repeat` | `Int` | Пересмотров |
| `priority` | `Int` | Приоритет |
| `private` | `Boolean` | Приватность |
| `notes` | `String` | Заметки |
| `hiddenFromStatusLists` | `Boolean` | Скрыть из списков |
| `customLists` | `[String]` | Кастомные списки |
| `advancedScores` | `[Float]` | Расширенные оценки |
| `startedAt` | `FuzzyDateInput` | Дата начала |
| `completedAt` | `FuzzyDateInput` | Дата завершения |

### UpdateMediaListEntries (обновить несколько записей)

Те же поля, но плюс `ids: [Int]` — массовое обновление.

### DeleteMediaListEntry

| Аргумент | Тип | Описание |
|----------|-----|----------|
| `id` | `Int` | ID записи для удаления |

---

## Примеры запросов

### Поиск аниме (без авторизации)

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

### Детали медиа + полный список полей

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

### Получить список пользователя (требует auth)

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

### Обновить статус/прогресс (требует auth)

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

## Важные заметки

1. **`averageScore` / `meanScore`** возвращаются в диапазоне **0–100**, не 0–10. Нужно делить на 10.
2. **Токен доступа** живёт 1 год, refresh tokens не поддерживаются.
3. **Rate limiting:** 90 запросов в минуту с одного IP.
4. **`MediaListCollection`** ограничен ~11,000 последними записями.
5. **Кастомные списки нельзя пропускать** — пользователь может скрыть записи из стандартных списков.
6. Для поиска: `Page.media(search: "...", type: ANIME)` — лимит 20 на страницу.
