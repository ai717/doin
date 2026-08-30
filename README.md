# DOIN

Static browser-game portal. The repository keeps source code on main; GitHub
Pages serves the static build from gh-pages.

## Layout

    index.html, css/, js/, assets/  Portal source
    games.json                     The only game-list data source
    games/<slug>/                  Independent game source
    scripts/build-site.mjs         Builds the complete site into dist/
    dist/                          Generated deployment output, not committed

## Local development

Serve the portal from the repository root so games.json can be fetched:

    npx serve .

Build the deployable static site:

    npm run build

## Adding a game

1. Add one entry to games.json.
2. Add its source under games/<slug>/.
3. For a plain static game, include games/<slug>/index.html.
4. For a buildable game, provide package.json, a build script, and write final
   files to games/<slug>/dist/.

For a browser-history SPA, set spa: true in its games.json entry and configure
the game router and asset URLs for /<slug>/. The site build creates the
GitHub Pages root fallback for one such game so direct links can load.

The site build copies each published game to dist/<slug>/. Games marked
comingSoon: true do not need source files yet and are excluded from the
sitemap.

Folders named node_modules, dist, or tests and anything starting with a dot are
never copied, so a game can keep its tests next to its source. Add an exclude
array to a games.json entry to keep further folders out of dist/, for example
reference material that lives beside the game source.

## GitHub Pages

The deploy workflow runs when main changes. Configure GitHub Pages once in the
repository settings to publish the gh-pages branch from / (root). The workflow
then replaces that branch with the generated dist/ content.

For a custom domain, set the PAGES_CNAME repository variable before the first
domain deployment. The workflow writes it to gh-pages on every publish, so the
CNAME marker cannot be lost on the next deployment.
