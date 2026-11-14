<p align="center">
  <a href="https://praveenpal4232.github.io/google-gifts/">
    <img src='img/Google-Gifts-Banner.webp' alt="Google Gifts"/>
  </a>
</p>

# Google Gifts

A curated, open-source directory of useful, creative and lesser-known Google tools, experiments and programs.

**Live site:** https://praveenpal4232.github.io/google-gifts/

- Instant search across names, tags, descriptions and use cases
- Categories, filters (pricing, platform, type, status, collection) and sorting
- Detail view for every tool, with shareable links (`?tool=flutter`)
- Save favourites, "Surprise me", light / dark / system theme
- Installable PWA that works offline

## How it works

No framework and no build step. `index.html` loads `js/main.js`, which fetches
[`data/tools.json`](data/tools.json) and renders everything in the browser. GitHub Pages serves
the repository as-is.

```
index.html          page shell
css/style.css       styles and theme tokens
js/main.js          search, filters, dialog, theme
data/tools.json     all tool data  ← edit this to add a tool
img/                tool images and app icons
sw.js               service worker (offline support)
scripts/check.mjs   data validator (runs in CI)
```

Run locally:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Contributing

Adding a tool means adding one object to `data/tools.json`. See [contributing.md](contributing.md).

## License

Except as otherwise noted, the content of this repo is licensed under the
[Creative Commons Attribution 4.0 International License](http://creativecommons.org/licenses/by/4.0/).

Google Gifts is an independent project and is not affiliated with or endorsed by Google LLC.
