# PROJECT_LOG.md

## Current status · 2026-08-29

### Completed

- Rebuilt the project as a clean static portal in ai717/doin: native homepage,
  games.json card data, pixel UI, SEO metadata, JSON-LD, robots, and generated
  sitemap.
- Migrated the static Sudoku SPA into games/sudoku/ without the original Grok
  server, authentication, database, or deployment scaffolding.
- Added a site-level build that assembles homepage and published games into
  dist/, then GitHub Actions publishes dist/ to gh-pages.
- Created the public repository, enabled GitHub Pages, and switched doin.win
  from the old repository to ai717/doin. HTTPS is enabled.
- Added PAGES_CNAME support; its current value is doin.win and gh-pages contains
  the matching CNAME file after deployment.

### Modified files

- Portal: index.html, css/style.css, js/main.js, games.json, robots.txt,
  assets/favicon.svg, assets/og-image.png.
- Build and deployment: package.json, scripts/build-site.mjs,
  scripts/gen-sitemap.mjs, .github/workflows/deploy.yml, .gitignore.
- Sudoku: games/sudoku/ package files, Vite configuration, public assets, and
  src/ application, engine, game-state, i18n, SEO, route, and component files.
- Documentation and rules: AGENTS.md, README.md, PROJECT_LOG.md.

### Key implementation

- main stores source only. The workflow invokes scripts/build-site.mjs, builds
  each published game, generates sitemap.xml, and force-publishes dist/ to
  gh-pages.
- Sudoku uses Vite asset base /sudoku/ and TanStack Router basepath /sudoku.
  Its icons, manifest, canonical links, hreflang links, and JSON-LD use the
  same subdirectory.
- The build generates a root 404.html from the one SPA entry so GitHub Pages can
  return the Sudoku application body for direct /sudoku/* requests.
- The optional PAGES_CNAME repository variable is passed to the deploy action,
  preserving the domain marker after every future deployment.

### Verification

- games/sudoku: npm run typecheck passed; npm test passed 17 tests.
- Root: npm run build passed and produced /sudoku/ assets with the required
  /sudoku/ prefix and sitemap entries for / and /sudoku/.
- Deployment: GitHub Actions run 33246508462 succeeded; doin.win and
  doin.win/sudoku/ returned HTTP 200. Pages is served from gh-pages with HTTPS.

### Notes

- GitHub Pages returns HTTP 404 for browser-history SPA deep links even though
  it serves the Sudoku fallback body. Those routes are intentionally excluded
  from sitemap.xml.
- GitHub Actions reports a non-blocking Node 20 deprecation warning for
  actions/checkout@v4 and actions/setup-node@v4. Current deployment succeeds.

### Next

- Upgrade checkout and setup-node actions to their current Node 24-compatible
  major versions, then verify one deployment.
