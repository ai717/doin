# AGENTS.md

## Project

DOIN is a static browser-game portal. The homepage lists independent games
published under /<slug>/; it never contains game implementation code.

## Repository and deployment

- Repository: ai717/doin. main is source only; never commit dist/ or game build
  output to main.
- GitHub Pages serves the gh-pages branch root. The deploy workflow builds the
  complete site into dist/ and replaces gh-pages with that output.
- Production domain: doin.win. The PAGES_CNAME repository variable is set to
  doin.win, and the workflow must retain its cname input so every deploy writes
  the CNAME marker again.
- Do not change the legacy ai717/doin.win repository or the doin.win domain
  without an explicit request.

## Source layout

    index.html, css/, js/, assets/  Homepage source
    games.json                     Only game-list data source
    games/<slug>/                  Independent game source
    scripts/build-site.mjs         Site-level build entry point
    start.bat                      One-click local launcher (auto-selects a free
                                   port near 46810)
    dist/                          Generated deployment output, ignored

Locally the portal serves the repo root so games live at `/games/<slug>/`;
the production URL on GitHub Pages is `/<slug>/` (the build flattens paths).

## Games

- A plain static game has games/<slug>/index.html.
- A buildable game has package.json with a build script and writes static files
  to games/<slug>/dist/.
- Buildable games deployed below /<slug>/ must configure their asset base and
  client router base path for that directory.
- Set spa: true in games.json for a browser-history SPA. GitHub Pages supports
  one generated root fallback; direct SPA deep links render but retain HTTP 404
  and must not be placed in the sitemap.
- games.json fields: title, slug, desc, icon, cover, tags, url, comingSoon;
  spa is optional for SPA fallback generation, exclude is an optional list of
  extra source folders to keep out of the build, and comingSoon games are not
  built or included in the sitemap. The build always skips node_modules, dist,
  tests, and dot-folders, so games may keep tests/ next to their source.
- The pixel theme below is NOT mandatory for games. Each game under
  games/<slug>/ may define its own visual style that fits its gameplay; do not
  force new games into the portal's pixel look.

## Homepage, SEO, and style

- Homepage code is native HTML, CSS, and ES modules. Do not add a framework or
  a portal build dependency.
- games.json drives cards, JSON-LD, and scripts/gen-sitemap.mjs. Keep sitemap
  entries limited to the homepage and non-comingSoon same-domain game roots.
- Keep the homepage pixel theme: #0b0b1a base, existing neon CSS variables,
  Press Start 2P only for display accents, and hard-edge shadows. This rule
  applies to the portal homepage only; subgames are free to use other styles.

## Working rules

- Complete one independent feature at a time, use small patches, and update
  PROJECT_LOG.md after development work.
- Run npm run build from the repository root after changes affecting the portal,
  games.json, build scripts, or deployment.
- For Sudoku changes, also run npm run typecheck and npm test in games/sudoku.
- For 2048 changes, run node --test tests/engine.test.mjs tests/storage.test.mjs
  tests/i18n.test.mjs tests/markup.test.mjs in games/2048. Node 22 needs file
  names or a glob; passing only the tests directory fails.
- The deploy workflow uses actions/checkout@v4 and actions/setup-node@v4;
  upgrade both to their current Node 24-compatible major versions when a
  convenient window opens.
