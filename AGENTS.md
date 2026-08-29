# AGENTS.md

## Project

DOIN is a static browser-game portal. The portal links to independent games
published under /<slug>/.

## Source and publishing boundary

- main contains source files only. Never commit dist/ or built game assets to
  main.
- GitHub Actions builds the complete static site into dist/ and publishes its
  contents to the gh-pages branch.
- The portal is plain HTML, CSS, and ES module JavaScript. Do not add a portal
  framework or build dependency.
- Games live in games/<slug>/. A game may be plain static files or have its own
  package.json; either way its final output must be static files.

## Data and style

- games.json is the only game-list data source.
- Reuse the existing CSS variables for the pixel theme. Keep card borders and
  shadows hard-edged.
- Add new games by changing games.json and adding games/<slug>/; do not
  hard-code game cards in page JavaScript.

## Workflow

- Complete one independent feature at a time and update PROJECT_LOG.md.
- Prefer small patches and preserve the source/publish separation above.
- scripts/build-site.mjs is the only site-level build entry point.
