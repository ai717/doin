# PROJECT_LOG.md

## 2026-08-29 · Step 1: clean portal foundation

### Completed

- Created a source-only static portal with the established DOIN pixel visual
  language and SEO metadata.
- Added games.json as the single source of truth; Sudoku was initially listed
  as coming soon until its source migration.
- Added site-level build scripts that produce the entire deployable site in
  dist/, including the generated sitemap.
- Added GitHub Actions deployment that publishes only dist/ to gh-pages.

### Not included

- No Sudoku source or build output was copied in this step.
- GitHub Pages branch selection and custom-domain configuration were not
  changed.

## 2026-08-29 · Step 2: Sudoku migration

### Completed

- Migrated the already-static Sudoku source to games/sudoku/ from the cleaned
  source tree, excluding node_modules, previous dist output, and cache files.
- Kept the Vite build base at /sudoku/ and configured TanStack Router with the
  same base path so internal navigation remains inside the game directory.
- Corrected game icons, manifest, canonical links, hreflang links, and JSON-LD
  URLs to use /sudoku/.
- Removed the redundant game-level robots.txt and sitemap.xml; the portal
  sitemap remains the single sitemap entry point for this domain.
- Added the GitHub Pages root fallback for the Sudoku history-mode SPA, so a
  direct /sudoku/* request can load the game instead of a static 404 page.
- Site builds use npm ci in CI or when game dependencies are absent; local
  rebuilds reuse installed dependencies.

### Verification

- npm run typecheck completed without errors.
- npm test passed all 17 engine, score, and achievement tests.
- The root npm run build generated dist/sudoku/ with /sudoku/ asset paths and
  a root 404.html matching the Sudoku entry point.
- Local static preview returned HTTP 200 for /, /sudoku/, and the Sudoku entry
  script.

### Next

- Create the remote repository, configure GitHub Pages to serve gh-pages, and
  publish the source when deployment is explicitly approved.
