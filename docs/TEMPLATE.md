# Babylon — Template System

Templates are `.md` files with placeholders that get replaced with actual data from the API when creating notes.

## Preset mode (recommended, v0.5.0)

With a **preset** configured for a media type, the preset owns the frontmatter and the template file only provides the **body** of the note:

1. In **Settings → Media Types → Presets** open the preset editor (or press **Regenerate template**).
2. The preset defines which fields exist and their frontmatter names.
3. The generated body template uses the preset's `property` names as placeholders — `{{property}}` for scalars, `{{property_list}}` for arrays.
4. Renaming a field in the preset changes the placeholder used in templates — one name everywhere.
5. When no preset exists, the legacy full-template rendering below applies.

## Legacy mode (no preset)

## How it works

1. Create a `.md` file anywhere in your vault
2. Use `{{placeholder}}` syntax where you want data to appear
3. Set the template file path in **Babylon settings** → **Media Types** → template path
4. When you add content via Babylon, the template is rendered with real data

## Available placeholders

### Basic info

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{title}}` | Media title (English) | "Attack on Titan" |
| `{{original_title}}` | Original title (Romaji/Native) | "Shingeki no Kyojin" |
| `{{year}}` | Release year | 2013 |
| `{{description}}` | Plot description (no HTML) | "Centuries ago..." |
| `{{format}}` | Media format | "TV", "Movie", "OVA" |
| `{{status}}` | Airing/publishing status | "FINISHED", "RELEASING" |

### Metadata

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{genres}}` | Genres (comma separated) | "Action, Drama, Fantasy" |
| `{{genre_list}}` | Genres (YAML list) | `- "Action"\n- "Drama"` |
| `{{creators}}` | Studios (comma separated) | "Wit Studio, MAPPA" |
| `{{creator_list}}` | Studios (YAML list) | `- "Wit Studio"\n- "MAPPA"` |

### Scores & links

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{rating}}` | Score out of 100 | 86 |
| `{{rating_10}}` | Score out of 10 | 8.6 |
| `{{popularity}}` | Media popularity | 125000 |
| `{{url}}` | Source page URL | https://anilist.co/anime/... |
| `{{source_id}}` | ID in source system | 16498 |
| `{{source}}` | Provider name | "anilist" |

### Media-specific

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{episodes}}` | Total episodes (anime) | 75 |
| `{{cover}}` | Cover/poster image URL | https://...jpg |

## Example template

```markdown
---
title: "{{title}}"
original_title: "{{original_title}}"
year: {{year}}
format: "{{format}}"
episodes: {{episodes}}
status: "{{status}}"
genres:
{{genre_list}}
studios:
{{creator_list}}
rating: {{rating}}
cover: "{{cover}}"
url: "{{url}}"
source_id: "{{source_id}}"
provider: "{{source}}"
my_rating:
my_status: "not_started"
my_progress: 0
---

![]({cover})

# {{title}}

> {{description}}

**Year:** {{year}} | **Format:** {{format}} | **Episodes:** {{episodes}}
**Genres:** {{genres}}
**Studios:** {{creators}}
**Rating:** ⭐ {{rating_10}}/10

[View source]({{url}})
```

## Tips

- Placeholders not found in the template are left as-is (e.g. `{{unknown}}` stays `{{unknown}}`)
- You can use placeholders in both frontmatter (YAML) and the note body
- If no template is configured, the built-in default template (shown above) is used
- Create separate templates for different media types (anime, movie, etc.)
