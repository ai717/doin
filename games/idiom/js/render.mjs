// 书页渲染：网格、释义、字库与金粉粒子。只读引擎状态，不参与规则判定。
const GOLD = ["#d8ae5c", "#b98b34", "#f2d98f", "#a83227"];

export function createRenderer({ grid, clueList, clueCurrent, rack, gridProgress, fx, t }) {
  let locale = "zh";
  let current = null;
  let puzzle = null;
  let cellSize = 44;
  let cellNodes = new Map();
  let clueNodes = [];
  let numberAt = new Map();
  let neededChars = new Set();
  let frame = 0;
  let particles = [];
  let raf = 0;
  let dpr = 1;
  let legend = [];

  const dispatch = (intent) => {
    if (typeof current?.dispatch === "function") current.dispatch(intent);
  };

  function registerDispatch(fn, getState) {
    current = { dispatch: fn, state: getState };
  }

  function resizeCanvas() {
    if (!fx) return;
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const width = globalThis.innerWidth || 1024;
    const height = globalThis.innerHeight || 768;
    fx.width = Math.floor(width * dpr);
    fx.height = Math.floor(height * dpr);
    fx.style.width = `${width}px`;
    fx.style.height = `${height}px`;
  }

  function spawnBurstAt(x, y, count = 16) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 150;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.5 + Math.random() * 0.6,
        age: 0,
        size: 1.2 + Math.random() * 2.4,
        color: GOLD[Math.floor(Math.random() * GOLD.length)],
        spin: Math.random() * Math.PI,
      });
    }
    if (!raf) raf = requestAnimationFrame(stepParticles);
  }

  function stepParticles(now) {
    raf = 0;
    const ctx = fx?.getContext("2d");
    if (!ctx) return;
    const last = stepParticles.last ?? now;
    const dt = Math.min(0.05, (now - last) / 1000);
    stepParticles.last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, globalThis.innerWidth || 1024, globalThis.innerHeight || 768);
    particles = particles.filter((p) => p.age < p.life);
    for (const p of particles) {
      p.age += dt;
      p.vy += 220 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const alpha = Math.max(0, 1 - p.age / p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (particles.length) raf = requestAnimationFrame(stepParticles);
    else stepParticles.last = 0;
  }

  function burstAtElement(element, count) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    spawnBurstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, count);
  }

  function computeCellSize() {
    if (!puzzle) return;
    const wrap = grid?.parentElement;
    if (!wrap) return;
    const gap = 3;
    const rect = wrap.getBoundingClientRect();
    const width = Math.max(120, rect.width);
    const height = Math.max(120, rect.height);
    const byWidth = (width - gap * (puzzle.cols - 1)) / puzzle.cols;
    const byHeight = (height - gap * (puzzle.rows - 1)) / puzzle.rows;
    const size = Math.floor(Math.min(byWidth, byHeight, 66));
    const next = Math.max(24, Math.min(66, size));
    if (Math.abs(next - cellSize) > 0.5) {
      cellSize = next;
      grid.style.setProperty("--cell", `${cellSize}px`);
    }
  }

  function buildNumbers() {
    numberAt = new Map();
    legend = [];
    const sorted = puzzle.entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => a.entry.row - b.entry.row || a.entry.col - b.entry.col || (a.entry.dir === "across" ? -1 : 1));
    let counter = 0;
    const seen = new Map();
    for (const item of sorted) {
      const key = `${item.entry.row},${item.entry.col}`;
      if (!seen.has(key)) {
        counter += 1;
        seen.set(key, counter);
      }
      numberAt.set(item.index, seen.get(key));
      legend.push({ index: item.index, number: seen.get(key), entry: item.entry });
    }
  }

  function buildGrid() {
    grid.innerHTML = "";
    grid.style.setProperty("--cols", String(puzzle.cols));
    grid.style.setProperty("--rows", String(puzzle.rows));
    grid.style.setProperty("--cell", `${cellSize}px`);
    cellNodes = new Map();
    const answers = new Map(puzzle.cells.map((item) => [`${item.r},${item.c}`, item.answer]));
    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        const key = `${r},${c}`;
        const char = answers.get(key);
        if (!char) {
          const spacer = document.createElement("div");
          spacer.className = "cell void";
          spacer.setAttribute("aria-hidden", "true");
          grid.appendChild(spacer);
          continue;
        }
        const node = document.createElement("button");
        node.type = "button";
        node.className = "cell";
        node.dataset.r = String(r);
        node.dataset.c = String(c);
        node.setAttribute("role", "gridcell");
        const number = document.createElement("span");
        number.className = "num";
        node.appendChild(number);
        const text = document.createElement("span");
        text.className = "char";
        node.appendChild(text);
        node.addEventListener("click", () => dispatch({ type: "cell", r, c }));
        grid.appendChild(node);
        cellNodes.set(key, { node, text, number });
      }
    }
    // 给每个字格标上所属词条的起始编号，便于与释义栏对应。
    for (const entry of puzzle.entries) {
      const number = numberAt.get(entry.index);
      const key = `${entry.row},${entry.col}`;
      const cell = cellNodes.get(key);
      if (cell && number) cell.number.textContent = String(number);
    }
  }

  function buildClues() {
    clueList.innerHTML = "";
    clueNodes = [];
    for (const item of legend) {
      const entry = item.entry;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clue";
      button.dataset.index = String(item.index);
      const tag = document.createElement("span");
      tag.className = "clue-tag";
      tag.textContent = `${item.number}${entry.dir === "across" ? t(locale, "across") : t(locale, "down")}`;
      const text = document.createElement("span");
      text.className = "clue-text";
      const main = document.createElement("b");
      main.textContent = entry.clue;
      text.appendChild(main);
      button.append(tag, text);
      button.addEventListener("click", () => dispatch({ type: "entry", index: item.index }));
      clueList.appendChild(button);
      clueNodes.push(button);
    }
  }

  function buildRack() {
    rack.innerHTML = "";
    const answers = new Set(puzzle.cells.map((item) => item.answer));
    neededChars = answers;
    for (const char of puzzle.rack) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      if (!answers.has(char)) tile.classList.add("is-distractor");
      tile.textContent = char;
      tile.setAttribute("aria-label", char);
      tile.addEventListener("click", () => dispatch({ type: "fill", char }));
      rack.appendChild(tile);
    }
  }

  function updateGrid(state) {
    if (!state || !puzzle) return;
    const selected = state.selected;
    const activeKeys = new Set();
    if (selected) {
      const entry = state.entries[selected.entryIndex];
      if (entry) {
        for (let i = 0; i < entry.len; i += 1) {
          const r = entry.row + (entry.dir === "down" ? i : 0);
          const c = entry.col + (entry.dir === "across" ? i : 0);
          activeKeys.add(`${r},${c}`);
        }
      }
    }
    for (const [key, ref] of cellNodes) {
      const cell = state.cells.get(key);
      if (!cell) continue;
      ref.text.textContent = cell.value ?? "";
      ref.node.classList.toggle("in-entry", activeKeys.has(key));
      ref.node.classList.toggle("is-active", selected?.cellKey === key);
      ref.node.classList.toggle("is-solved", cell.value === cell.answer && cell.value !== null);
      ref.node.classList.toggle("is-locked", Boolean(cell.locked));
      ref.node.classList.toggle("is-wrong", Boolean(cell.value) && cell.value !== cell.answer);
      ref.node.setAttribute(
        "aria-label",
        `${cell.r + 1}-${cell.c + 1}${cell.value ? ` ${cell.value}` : ""}`,
      );
    }
  }

  function updateClues(state) {
    if (!state) return;
    for (const node of clueNodes) {
      const index = Number(node.dataset.index);
      const entry = state.entries[index];
      if (!entry) continue;
      node.classList.toggle("is-solved", Boolean(entry.solved));
      node.classList.toggle("is-active", state.selected?.entryIndex === index);
    }
    const selected = state.selected;
    if (selected) {
      const entry = state.entries[selected.entryIndex];
      if (entry) {
        clueCurrent.innerHTML = "";
        const label = document.createElement("strong");
        label.textContent = t(locale, "progressLabel", {
          done: state.entries.filter((item) => item.solved).length,
          total: state.entries.length,
        });
        const hint = document.createElement("span");
        hint.textContent = ` · ${entry.clue}`;
        clueCurrent.append(label, hint);
      }
    } else {
      clueCurrent.textContent = t(locale, "clueEmpty");
    }
    const solvedEntries = state.entries.filter((entry) => entry.solved).length;
    const filled = [...state.cells.values()].filter((cell) => cell.value === cell.answer).length;
    gridProgress.textContent = `${filled}/${state.cells.size} · ${solvedEntries}/${state.entries.length}`;
  }

  function pulse(kind, r, c) {
    const ref = cellNodes.get(`${r},${c}`);
    if (!ref) return;
    const name = kind === "wrong" ? "is-wrong" : kind === "hint" ? "is-hinted" : "is-flash";
    ref.node.classList.remove(name);
    // 强制回流，保证重复触发时动画能重放。
    void ref.node.offsetWidth;
    ref.node.classList.add(name);
    globalThis.setTimeout(() => ref.node.classList.remove(name), 780);
    if (kind !== "wrong") burstAtElement(ref.node, kind === "flash" ? 12 : 8);
  }

  function flashEntry(entryIndex) {
    const state = current?.state?.();
    const entry = state?.entries?.[entryIndex];
    if (!entry) return;
    for (let i = 0; i < entry.len; i += 1) {
      const r = entry.row + (entry.dir === "down" ? i : 0);
      const c = entry.col + (entry.dir === "across" ? i : 0);
      pulse("flash", r, c);
    }
  }

  function render(state, nextPuzzle) {
    if (nextPuzzle) {
      puzzle = nextPuzzle;
      buildNumbers();
      buildClues();
      buildRack();
      buildGrid();
      gridProgress.textContent = "";
      computeCellSize();
      requestAnimationFrame(() => {
        computeCellSize();
        update(state);
      });
      return;
    }
    update(state);
  }

  function update(state) {
    if (!state) return;
    updateGrid(state);
    updateClues(state);
    if (state.selected) {
      const node = clueNodes[state.selected.entryIndex];
      if (node && node.scrollIntoView) {
        const box = clueList.getBoundingClientRect();
        const rect = node.getBoundingClientRect();
        if (rect.top < box.top || rect.bottom > box.bottom) node.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function scrollClueIntoView(index) {
    const node = clueNodes[index];
    if (node?.scrollIntoView) node.scrollIntoView({ block: "nearest" });
  }

  function setLocale(next) {
    locale = next === "en" ? "en" : "zh";
  }

  function resize() {
    resizeCanvas();
    computeCellSize();
  }

  resizeCanvas();
  if (typeof ResizeObserver !== "undefined" && grid) {
    const observer = new ResizeObserver(() => {
      computeCellSize();
    });
    observer.observe(grid.parentElement ?? grid);
    globalThis.addEventListener("resize", resize);
  } else {
    globalThis.addEventListener("resize", resize);
  }

  return {
    registerDispatch,
    render,
    update,
    pulse,
    flashEntry,
    scrollClueIntoView,
    setLocale,
    resize,
  };
}
