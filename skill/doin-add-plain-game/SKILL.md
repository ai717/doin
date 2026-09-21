---
name: doin-add-plain-game
agent_created: true
description: This skill should be used when adding a new plain static browser game to the DOIN portal (games under G:/work/code/game/doin). It records the project conventions, module layout, test wiring, cover requirements, and build registration.
---

# DOIN · 添加零依赖静态子游戏

Use this skill when the user wants a new plain static game in the DOIN portal at `G:/work/code/game/doin`.
Plain static games have no `package.json` and are copied as-is into `dist/<slug>/` by `scripts/build-site.mjs`.

## Project context to read first

Read these files before any implementation:

- `AGENTS.md` — project rules and per-game stable baselines.
- `PROJECT_LOG.md` — recent state snapshot.
- `games.json` — the only game catalog source.
- `package.json` — root test scripts.
- `index.html` / `css/style.css` / `js/main.js` — homepage behavior.
- A sibling plain game, e.g. `games/tic-tac-toe/` or `games/minesweeper/`, for the latest conventions.

## Standard module layout

Create under `games/<slug>/`:

```
games/<slug>/
├── index.html              # page shell, favicon link, stylesheet, main module
├── favicon.svg             # optional but preferred
├── css/style.css           # game-specific visual style
├── js/
│   ├── engine.mjs          # rule authority: pure functions, no DOM
│   ├── game.mjs            # DOM-free controller, holds state + timing
│   ├── ui.mjs              # only DOM owner: render + event binding
│   ├── main.mjs            # wiring: imports + mountUI + event listeners
│   └── other modules as needed (level.mjs, solver.mjs, score.mjs, storage.mjs, audio.mjs, ...)
└── tests/
    ├── engine.test.mjs     # node --test
    ├── game.test.mjs
    └── ...
```

Rules:

1. `engine.mjs` is the only rule authority.
2. `game.mjs` receives UI intents and calls the engine; it is DOM-free.
3. `ui.mjs` owns all DOM access and does not derive board state by itself.
4. `main.mjs` only wires modules together.
5. Never mutate state in place; return new state objects. No-ops should return the same reference so callers can check with `===`.
6. All invalid user actions must degrade gracefully — never throw from engine/game.

## Test wiring

Add a root script in `package.json`:

```json
"test:<slug>": "node --test games/<slug>/tests/*.test.mjs"
```

Use `node --test` with explicit file paths (Node 22 does not auto-discover nested test files reliably on all platforms).

## Cover image

- Required: `assets/covers/<slug>.webp`.
- Must be 640×640 WebP, 1:1 aspect ratio.
- Match the game's own visual theme; the homepage card is a square tile.
- If no existing cover exists, generate one with Pillow in the managed Python venv:
  - venv: `C:/Users/everg/.workbuddy/binaries/python/envs/default/Scripts/python.exe`
  - install: `python -m pip install Pillow`
  - output: `assets/covers/<slug>.webp`
- Avoid committing the generation script into `dist/`; add `"exclude": ["scripts"]` to the game's `games.json` entry if a helper script lives inside `games/<slug>/scripts/`.

## Catalog registration

Add an entry to `games.json`:

```json
{
  "title": "...",
  "slug": "<slug>",
  "desc": "...",
  "icon": "...",
  "cover": "/assets/covers/<slug>.webp",
  "tags": ["益智"],
  "url": "/<slug>/",
  "exclude": ["scripts"]
}
```

- `url` is `/<slug>/` (local dev maps `/games/<slug>/`, production is flat).
- `exclude` entries must be bare top-level directory names (no trailing slash).

## Verification checklist

1. `npm run test:<slug>` passes.
2. `npm run build` passes.
3. `dist/<slug>/` exists and contains expected files.
4. `dist/assets/covers/<slug>.webp` exists.
5. `dist/sitemap.xml` includes `https://doin.win/<slug>/`.
6. Home page renders the new card at `http://localhost:46810/` when `node _dev-server.mjs` is running.
7. Update `AGENTS.md` with a new stable baseline section for the game.
8. Append a concise entry to `.workbuddy/memory/YYYY-MM-DD.md`.

## Path conventions

- Local dev: `/games/<slug>/`
- Production: `/<slug>/`
- Module cache-busting placeholder: `?v=dev` in source; build script replaces it with `BUILD_ID`.
