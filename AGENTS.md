# AGENTS.md

## Project

DOIN is a static browser-game portal. The homepage lists independent games
published under /<slug>/; it never contains game implementation code.
`games.json` is the single source of truth for the game list.

## Repository and deployment

- Repository: ai717/doin. main carries source only; never commit dist/ or game
  build output.
- GitHub Pages serves the gh-pages branch root. On every main push the workflow
  builds the whole site into dist/ and replaces gh-pages with that output.
- Production domain: doin.win. The PAGES_CNAME variable is set to doin.win and
  the workflow must keep its cname input so each deploy rewrites the CNAME file.
- Do not touch the legacy ai717/doin.win repository or the doin.win domain
  without an explicit request.

## Source layout

    index.html, css/, js/, assets/  Homepage source
    games.json                     Only game-list data source
    games/<slug>/                  Independent game source
    scripts/build-site.mjs         Site-level build entry point
    start.bat                      Local launcher (auto-picks a free port
                                   near 46810)
    dist/                          Generated output, ignored

Locally the portal is served from the repo root, so games live at
`/games/<slug>/`. In production they are at `/<slug>/` — the build flattens the
path. Do not mix the two.

## Games

- Plain static game: `games/<slug>/index.html`, no package.json.
- Buildable game: `package.json` with a build script, output to
  `games/<slug>/dist/`; it must set its asset base and router base to `/<slug>/`.
- `spa: true` marks a browser-history SPA. GitHub Pages supports one generated
  root fallback; deep links render but keep HTTP 404, so they stay out of the
  sitemap.
- games.json fields: `title, slug, desc, icon, cover, tags, url, comingSoon`;
  `spa` and `exclude` are optional. `comingSoon` games are neither built nor
  listed in the sitemap. `exclude` names extra source folders to keep out of
  dist/; the build already skips `node_modules`, `dist`, `tests` and dot-folders,
  so a static game may keep `tests/` beside its source.
- Games define their own visual style. The portal theme below constrains the
  homepage only.

### orbit-sort stabilization baseline

- Current release exposes exactly seven mainline levels from
  `games/orbit-sort/levels.mjs` (`LEVELS = ALL_LEVELS.slice(0, 7)`), cut to the
  D1..D7 progression in `games/orbit-sort/difficulty.mjs`; the older verified
  catalog after level 7 is retained as source material only and must not be
  re-exposed accidentally.
- `difficulty.mjs` holds the hard parameter bounds (capacity 3..7, colorCount
  3..6, dockCount 1..2, exactly one empty track) and the buffer-ratio rule that
  a newly introduced parameter gets `dockCount: 2` for one level before it is
  pulled back to 1. Do not add levels that violate those bounds.
- `engine.mjs` is the sole authority for legality. A legal action must execute;
  a deadlock is a post-move state, not a violation or a reason to block the
  action. Only `won` is terminal. `game.mjs` accepts UI intents and delegates
  them to the engine; page code must not construct rule actions or mutate game
  state directly (the page's `state` is a mirror of `game.state`, so any direct
  `state = {...state, ...}` is overwritten on the next `dispatch`).
- UI feedback must go through the page helpers in `js/main.mjs`, not be
  hard-coded per call site: status text via `message(text, tone)` with tone
  `good|warn|bad|info`, touch feedback via `haptic()`, counters via `bump()`.
  Every animation must degrade under `prefers-reduced-motion: reduce`.
- `generator.mjs` validates balance, structure, solvability and every legal
  first move. `deadEndFirstMoves` is an audit metric; use
  `maxDeadEndFirstMoves` only when a release explicitly requires a stricter
  level-quality threshold. Solver timeouts are unknown, not unsolvable.
- After touching orbit-sort, run `npm run test:orbit-sort` from the repository
  root. It is also a required pre-build CI gate. Run `npm run build` when the
  portal, build scripts, games.json, or deployment workflow changes.
- Local game URL is `/games/orbit-sort/`; production URL is `/orbit-sort/`.
  Source modules use `?v=dev`; production build rewrites those references to
  one build id, including Worker URLs and Worker imports.

## Homepage, SEO, and style

- Homepage code is native HTML, CSS and ES modules. No framework, no build
  dependency for the portal itself.
- games.json drives the cards, JSON-LD and `scripts/gen-sitemap.mjs`. Sitemap
  entries stay limited to the homepage and non-comingSoon same-domain game roots.
- Homepage theme is Poki-inspired, not pixel art: `--bg #83ffe7` mint over a
  fixed `assets/bg-diamante.svg` texture, `--ink #002b50`, `--accent #009cff`,
  white surfaces, `--radius 16px`, `--gap 16px`, soft `rgba(93,107,132,…)`
  shadows. System sans-serif only — no webfont is loaded.
- Cards are cover-only square tiles (`aspect-ratio: 1/1`) in an `auto-fill`
  grid of `minmax(204px, 1fr)`, dropping to 140px under 520px. No tags,
  description or category grouping on the card; the title is an overlay that
  fades up on hover.
- Hover is asymmetric on purpose: 0.6s `cubic-bezier(0.25,0.1,0.25,1)` at rest,
  overridden to 0.3s while hovered, `scale(1.04) translateY(-4px)`. Hovered
  tiles also need `z-index` because `container-type` makes each card a stacking
  context. All motion degrades under `prefers-reduced-motion: reduce`.
- `cover` in games.json must be a 1:1 image; the shipped set is 640x640 WebP
  under `assets/covers/<slug>.webp`. Non-square art gets cropped by
  `object-fit: cover`.

## Working rules

- Ship one independent feature at a time in small patches, then update
  PROJECT_LOG.md.
- Run `npm run build` from the repository root after touching the portal,
  games.json, build scripts or deployment.
- Run each affected game's tests before pushing:
  - Sudoku: `npm run typecheck && npm test` in `games/sudoku`.
  - 2048: `node --test tests/engine.test.mjs tests/storage.test.mjs
    tests/i18n.test.mjs tests/markup.test.mjs` in `games/2048`. Node 22 needs
    file names or a glob — passing only the `tests` directory fails.
- Commit messages follow the existing history: English, conventional-commit
  prefix (feat / fix / docs / chore), explain the why in the body.
- The deploy workflow still uses `actions/checkout@v4` and `actions/setup-node@v4`;
  upgrade both to their current Node 24-compatible majors when a window opens.
