# Contributing to Google Gifts

Thanks for helping! The most useful contribution is a **new tool**, or a **fix to an existing one**
(dead link, rename, outdated pricing).

## Add a tool

1. Edit [`data/tools.json`](data/tools.json) and add an object to the `tools` array.
2. Optionally add an image to `img/` (500×300 `.webp`, logo centred on white). Without one, the
   site shows a coloured tile with the tool's initials.
3. Run the validator:
   ```bash
   node scripts/check.mjs          # schema checks
   node scripts/check.mjs --links  # also checks every URL responds
   ```
4. Open a pull request with a short description and a link to the official page you used as the source.

### Minimal entry

```json
{
  "id": "quick-draw",
  "name": "Quick, Draw!",
  "tagline": "A drawing game where a neural network guesses your doodles.",
  "url": "https://quickdraw.withgoogle.com/",
  "category": "culture",
  "type": "experiment",
  "pricing": "free",
  "status": "active",
  "added": "2026-11-14",
  "verified": "2026-11-14"
}
```

### All fields

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Unique, kebab-case. Used in links: `?tool=<id>` |
| `name` | yes | |
| `tagline` | yes | One sentence, ≤ 120 characters, shown on cards |
| `url` | yes | Official `https://` URL |
| `category` | yes | One of the `categories[].id` values at the top of the file |
| `type` | yes | `app`, `platform`, `program`, `resource`, `experiment` |
| `pricing` | yes | `free`, `freemium`, `paid`, `unknown`. **Use `unknown` rather than guessing** |
| `status` | yes | `active`, `beta`, `discontinued`, `unavailable` (temporarily down / region-limited) |
| `description` | | Longer overview for the detail view |
| `image` | | Path under `img/` |
| `tags` | | Search keywords, lowercase |
| `collections` | | Any of `hidden-gems`, `ai-powered`, `experiments` |
| `features`, `useCases` | | Arrays of short strings |
| `pricingNote` | | e.g. "Free tier; Pro plan is paid." |
| `platforms` | | Any of `web`, `android`, `ios`, `desktop` |
| `openSource` | | `true` / `false`. Leave out if unsure |
| `formerly` | | Previous name, e.g. `"Google Data Studio"` (also searchable) |
| `statusNote` | | Why it is discontinued, renamed, redirected… |
| `featured` | | `true` to show in the Featured row (maintainers decide) |
| `added`, `verified` | | `YYYY-MM-DD`. Update `verified` when you re-check a tool |
| `related` | | Array of other tool `id`s. Similar tools are also suggested automatically |
| `resources` | | `[{ "label": "Docs", "url": "https://…" }]` |

## Data quality rules

- Only state facts you can confirm on an official Google page. No invented prices, features or dates.
- Discontinued tools stay in the list with `"status": "discontinued"` and a `statusNote`. Don't delete them.
- Renamed products: update `name` and `url`, put the old name in `formerly`.
- Keep the `id` stable once published, because shared links depend on it.

## Code changes

There is no build step. Serve the folder with `python3 -m http.server` and open it in a browser.
If you change files listed in `PRECACHE` in `sw.js`, bump `VERSION` there so returning visitors get the update.
