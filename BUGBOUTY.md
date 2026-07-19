# Bug Log

## [fixed] Placeholders not replaced due to a single invalid GraphQL field

### Symptom

User picks fields in settings → creates a note → placeholders like `{{bannerImage}}`, `{{synonyms}}`, `{{nextAiringEpisode}}` remain unreplaced. Console shows: `fetchDetails failed, falling back to list data Error: HTTP 400`.

### Root cause (3 levels)

1. **Deleted field still in user settings.**  
   Field `trendingAmount` was removed from `src/fields/definitions/anime.ts` (field definitions), but the user still has it saved in Obsidian `data.json` → `requestedFields`.

2. **No field definition found → name goes into GraphQL "as-is".**  
   `getSelectedGraphQLFragments()` finds no `def` for `trendingAmount`, falls into the `else if (!def)` branch, and pushes raw `trendingAmount` as a query fragment. AniList has no such field.

3. **GraphQL: one invalid field kills the entire response.**  
   AniList returns HTTP 400 with `"data": null`. `fetchDetails` sees `null` → returns `null`. The code falls back to `raw` search data, which only has basic fields (`title`, `year`, `cover`, `format`, `id`). All extended fields (`bannerImage`, `synonyms`, `nextAiringEpisode`, etc.) are absent → placeholders stay unreplaced.

### Why some fields "always work"

`title`, `year`, `description`, `cover`, `episodes` etc. come not from GraphQL (which failed), but from `raw` — the search-result data that already carried them. So it appeared to the user that "some fields arrive, others don't."

### Solution

**1. Remove the field** — drop `trendingAmount` from field definitions, extraKeys, i18n.  
**2. Retry mechanism** — when a GraphQL query fails with `Cannot query field "X" on type "Media"`, automatically:

- Parse the field name from the error.
- Search `requestedFields` for the key that maps to that name.
- Add the key to `badFieldKeys: Set<string>`.
- Rebuild the query without that key and retry (up to 3 attempts).

**3. Split logic** — `fetchDetails` → `queryDetails` (query only) + `buildDetails` (parse only), so the retry doesn't duplicate code.

**4. Filter in `buildDetails`** — skip keys present in `badFieldKeys` when copying fields.

**5. Reset `badFieldKeys`** in `setRequestedFields` — errors live only within a single call.

### Bugs discovered along the way

- **Regex didn't account for JSON-escaped quotes.**  
  Error from `fetchJson()`: `"HTTP 400: {...,\"message\":\"Cannot query field \\\"trendingAmount\\\"...\"}"`.  
  In the Error string: `Cannot query field \"trendingAmount\" on type \"Media\"`.  
  Regex `/Cannot query field "([^"]+)" on type "Media"/` looked for `"trendingAmount"` (plain quotes), but the string had `\"trendingAmount\"` (escaped). Fixed to `/Cannot query field ["\\]+(\w+)["\\]+ on type/`.

- **Array index `[0]` in strict TS is `string | undefined`.**  
  `def.graphql.split(/[\s(]/)[0]` returns `string | undefined`, not assignable to `string | null`. Added `?? null`.

- **`fetchJson` throws two types of errors:**  
  (a) HTTP status >= 400 — `Error("HTTP NNN: <raw body>")` — contains JSON with escaped quotes.  
  (b) GraphQL errors with 200 status — `Error(errors[0].message)` — plain text, quotes already parsed.  
  Both are covered by the new regex.

### How to prevent recurrence

- When loading `requestedFields` from settings, validate keys against field definitions and drop dead ones.
- Add a preflight check: send a minimal query with a single field `query { Media(id: 1) { <field> } }` when adding a new field in the UI.
- In `getSelectedGraphQLFragments` for `!def` fields, either validate first or rely on retry (already done).
