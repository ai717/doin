// render.mjs — 唯一操作 DOM / Canvas 的渲染层。
// 人物与道具用 CSS 立体造型，Canvas 只画尘土、火花与星星粒子。

import { CHAPTERS, LEVEL_BY_ID, ITEM_KINDS } from "./levels.mjs";
import { t } from "./i18n.mjs";

const FIGHTER_W = 76;
const FIGHTER_H = 108;

const GROUND_TOP = 330;
const GROUND_SPAN = 176;

const PALETTES = {
  p1: { skin: "#ffd2ac", jersey: "#4fb3ff", pants: "#274761", hair: "#231a14", shoe: "#f6f6f0" },
  p2: { skin: "#f6c79a", jersey: "#ff9a3c", pants: "#5d3a1f", hair: "#2a1b12", shoe: "#fff4e0" },
  enemy_scrapper: { skin: "#ffcf9f", jersey: "#f0c64a", pants: "#6f4227", hair: "#33241a", shoe: "#efe7d8" },
  enemy_senior: { skin: "#f6bd8c", jersey: "#a06be0", pants: "#3f2a55", hair: "#2b1d33", shoe: "#e8e0f6" },
  enemy_runner: { skin: "#ffd6a8", jersey: "#5fd08a", pants: "#285a3e", hair: "#2c2417", shoe: "#f2f7ec" },
  enemy_ranger: { skin: "#ffc99a", jersey: "#ff8f5a", pants: "#5a2e1f", hair: "#332019", shoe: "#f6e9dc" },
  enemy_guard: { skin: "#eeb183", jersey: "#c9543f", pants: "#3d241d", hair: "#241611", shoe: "#ded3c4" },
  enemy_trickster: { skin: "#ffd4b4", jersey: "#54bdb4", pants: "#25504d", hair: "#1f2a2a", shoe: "#e6f4f1" },
  boss_pe: { skin: "#f8bd8c", jersey: "#e23b3b", pants: "#2b2d33", hair: "#1c1411", shoe: "#fff3e6" },
  boss_captain: { skin: "#efb075", jersey: "#2f6fd0", pants: "#1d2c46", hair: "#1a1410", shoe: "#f4f7ff" },
  boss_shopkeeper: { skin: "#e9b88f", jersey: "#d7a13c", pants: "#4a3524", hair: "#3a2b1d", shoe: "#e6dcc6" },
  boss_senior: { skin: "#f3bd93", jersey: "#7a3fbe", pants: "#241a35", hair: "#171019", shoe: "#efe6ff" },
};

const PROP_LAYOUT = [
  [
    { kind: "fence", x: 150, scale: 1 },
    { kind: "sand", x: 700, scale: 1 },
    { kind: "bench", x: 1180, scale: 1 },
    { kind: "fence", x: 1520, scale: 0.9 },
  ],
  [
    { kind: "hoop", x: 420, scale: 1 },
    { kind: "bench", x: 800, scale: 1 },
    { kind: "hoop", x: 1280, scale: 1 },
    { kind: "fence", x: 60, scale: 1 },
  ],
  [
    { kind: "awning", x: 220, scale: 1 },
    { kind: "crate", x: 640, scale: 1 },
    { kind: "dumpster", x: 980, scale: 1 },
    { kind: "crate", x: 1320, scale: 1.1, tall: true },
    { kind: "awning", x: 1560, scale: 0.85 },
  ],
  [
    { kind: "railing", x: 140, scale: 1 },
    { kind: "tank", x: 620, scale: 1 },
    { kind: "ac", x: 1020, scale: 1 },
    { kind: "railing", x: 1320, scale: 0.9 },
    { kind: "ac", x: 1680, scale: 0.9 },
  ],
];

function groundY(z) {
  return GROUND_TOP + z * GROUND_SPAN;
}

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function createRenderer(refs, options = {}) {
  const { stage, scaler, camera, skyline, props, actors, items, canvas, flash } = refs;
  const ctx = canvas.getContext("2d");
  let locale = options.locale ?? "zh";
  let chapter = -1;
  let width = 960;
  let height = 540;
  const fighters = new Map();
  const itemNodes = new Map();
  const particles = [];
  const stars = [];
  let shake = 0;
  let dpr = 1;

  function resizeCanvas() {
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();

  function setStageScale(scale) {
    scaler.style.setProperty("--stage-scale", String(scale));
    scaler.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function buildProps(index) {
    props.textContent = "";
    const layout = PROP_LAYOUT[index] ?? PROP_LAYOUT[0];
    for (const prop of layout) {
      const node = el("div", `prop prop-${prop.kind}`);
      node.style.left = `${prop.x}px`;
      node.style.transform = `scale(${prop.scale})`;
      node.style.transformOrigin = "50% 100%";
      if (prop.tall) node.classList.add("is-tall");
      if (prop.kind === "hoop") node.appendChild(el("div", "rim"));
      if (prop.kind === "bars") node.appendChild(el("div", "bar-line"));
      props.appendChild(node);
    }
  }

  function setChapter(index) {
    if (index === chapter) return;
    chapter = index;
    stage.dataset.chapter = String(index);
    buildProps(index);
  }

  function syncFighter(fighter) {
    const key = fighter.id;
    let entry = fighters.get(key);
    const isPlayer = fighter.team === "player";
    if (!entry) {
      const node = el("div", "fighter");
      const shadow = el("div", "shadow");
      const rig = el("div", "rig");
      rig.innerHTML = [
        '<div class="fig-arm back"><span class="fig-fist"></span></div>',
        '<div class="fig-leg left"><span class="fig-shoe"></span></div>',
        '<div class="fig-leg right"><span class="fig-shoe"></span></div>',
        '<div class="fig-torso"></div>',
        '<div class="fig-head"></div>',
        '<div class="fig-hair"></div>',
        '<div class="fig-face"></div>',
        '<div class="fig-arm front"><span class="fig-fist"></span></div>',
      ].join("");
      node.appendChild(shadow);
      node.appendChild(rig);
      const hp = el("div", "fig-hp");
      hp.appendChild(el("i"));
      node.appendChild(hp);
      actors.appendChild(node);
      entry = { node, rig, hp, tag: null, lastClass: "", kind: "" };
      fighters.set(key, entry);
    }
    const { node } = entry;
    const palette = isPlayer
      ? (fighter.slot === 1 ? PALETTES.p2 : PALETTES.p1)
      : (PALETTES[fighter.kind] ?? PALETTES.enemy_scrapper);
    node.style.setProperty("--skin", palette.skin);
    node.style.setProperty("--jersey", palette.jersey);
    node.style.setProperty("--pants", palette.pants);
    node.style.setProperty("--hair", palette.hair);
    node.style.setProperty("--shoe", palette.shoe);
    node.style.setProperty("--face", String(fighter.facing >= 0 ? 1 : -1));

    const scale = (isPlayer ? 1 : (fighter.scale ?? 1)) * (fighter.boss ? 1.06 : 1);
    node.style.left = `${fighter.x - FIGHTER_W / 2}px`;
    node.style.top = `${groundY(fighter.z) - fighter.h * 0.82 - FIGHTER_H}px`;
    node.style.transform = `translateZ(0) scale(${scale})`;
    node.style.zIndex = String(100 + Math.round(fighter.z * 100));

    const airborne = fighter.h > 4;
    node.style.setProperty("--shadow-scale", String(clamp(1 - fighter.h / 420, 0.45, 1)));
    node.style.setProperty("--shadow-opacity", String(clamp(1 - fighter.h / 360, 0.3, 1)));

    const classes = ["fighter"];
    if (isPlayer) classes.push(fighter.slot === 1 ? "is-player is-p2" : "is-player is-p1");
    if (fighter.boss) classes.push("is-boss");
    if (fighter.elite) classes.push("is-elite");

    if (fighter.downTimer > 0) classes.push("is-downed");
    else if (fighter.state === "launched") classes.push("is-launch");
    else if (fighter.state === "down" || fighter.dead) classes.push("is-down");
    else if (fighter.attack) {
      if (fighter.attack.type === "light") classes.push("is-light");
      else if (fighter.attack.type === "heavy" || fighter.attack.type === "suplex") classes.push("is-heavy");
      else if (fighter.attack.type === "jump") classes.push("is-jumpkick");
      else if (fighter.attack.type === "special") classes.push("is-special");
    } else if (airborne) classes.push("is-jump");
    else if (fighter.state === "hurt" || fighter.stun > 0.05) classes.push("is-hurt");
    else if (fighter.special?.phase === "charge") classes.push("is-charging");
    else if (!isPlayer && fighter.attack) classes.push("is-telegraph");
    else if (Math.abs(fighter.vx) > 8 || Math.abs(fighter.vz) > 0.02) classes.push("is-walk");

    if (!isPlayer && fighter.attack && fighter.attack.phase === "windup") classes.push("is-telegraph");

    const nextClass = classes.join(" ");
    if (nextClass !== entry.lastClass) {
      node.className = nextClass;
      entry.lastClass = nextClass;
    }

    node.style.opacity = fighter.spawnT > 0
      ? String(clamp(1 - fighter.spawnT * 0.7, 0.35, 1))
      : (isPlayer && fighter.invuln > 0 && Math.floor(fighter.invuln * 22) % 2 === 0 ? "0.62" : "1");

    const hpRatio = clamp(fighter.hp / Math.max(1, fighter.maxHp), 0, 1);
    const showHp = !isPlayer && !fighter.dead && hpRatio < 1 || (!isPlayer && fighter.boss);
    entry.hp.hidden = !showHp;
    if (showHp) {
      entry.hp.classList.toggle("is-boss", Boolean(fighter.boss));
      entry.hp.firstChild.style.width = `${hpRatio * 100}%`;
    }

    const needTag = !isPlayer && (fighter.boss || fighter.elite);
    if (needTag && !entry.tag) {
      entry.tag = el("div", "fig-tag");
      node.appendChild(entry.tag);
    }
    if (entry.tag) {
      entry.tag.hidden = !needTag;
      if (needTag) {
        const label = t(locale, fighter.nameKey ?? "foeScrapper");
        if (entry.tag.textContent !== label) entry.tag.textContent = label;
      }
    }
    entry.kind = fighter.kind;
  }

  function syncItem(item) {
    let node = itemNodes.get(item.id);
    if (!node) {
      node = el("div", "world-item");
      const glow = el("div", "item-glow");
      const body = el("div", "item-body");
      node.appendChild(glow);
      node.appendChild(body);
      items.appendChild(node);
      itemNodes.set(item.id, node);
    }
    const definition = ITEM_KINDS[item.kind];
    node.className = `world-item ${item.kind}`;
    node.hidden = Boolean(item.held);
    node.style.left = `${item.x - 15}px`;
    node.style.bottom = `${540 - groundY(item.z) + 6}px`;
    node.style.zIndex = String(90 + Math.round(item.z * 100));
    node.title = definition ? t(locale, definition.nameKey) : "";
  }

  function removeStale(state) {
    const aliveIds = new Set([...state.players, ...state.enemies].map((fighter) => fighter.id));
    for (const [id, entry] of fighters) {
      if (aliveIds.has(id)) continue;
      entry.node.remove();
      fighters.delete(id);
    }
    const itemIds = new Set(state.items.map((item) => item.id));
    for (const [id, node] of itemNodes) {
      if (itemIds.has(id)) continue;
      node.remove();
      itemNodes.delete(id);
    }
  }

  function spawnParticles(events, state) {
    for (const event of events) {
      const baseY = (z, h) => groundY(z) - (h ?? 0);
      if (event.type === "hit" || event.type === "impact") {
        const heavy = event.power === "heavy";
        const count = heavy ? 10 : 5;
        for (let i = 0; i < count; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (heavy ? 190 : 120) * (0.5 + Math.random());
          particles.push({
            type: heavy ? "spark" : "dot",
            x: (event.x ?? state.players[0].x) + (Math.random() - 0.5) * 26,
            y: baseY(event.z ?? 0.6, event.h ?? 46) + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed * 0.7 - 40,
            life: heavy ? 0.34 : 0.22,
            maxLife: heavy ? 0.34 : 0.22,
            size: heavy ? 4.5 : 2.6,
            color: heavy ? "#ffe08a" : "#fff6dc",
          });
        }
        if (heavy) {
          particles.push({
            type: "ring",
            x: event.x ?? state.players[0].x,
            y: baseY(event.z ?? 0.6, event.h ?? 46),
            vx: 0, vy: 0,
            life: 0.28, maxLife: 0.28, size: 12, color: "#ffd25e",
          });
        }
      } else if (event.type === "ko") {
        for (let i = 0; i < 12; i += 1) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
          const speed = 140 + Math.random() * 180;
          particles.push({
            type: "star",
            x: event.x, y: baseY(event.z, 60),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.65, maxLife: 0.65,
            size: 5 + Math.random() * 3,
            color: "#ffe89a",
          });
        }
      } else if (event.type === "land") {
        for (let i = 0; i < 7; i += 1) {
          particles.push({
            type: "dust",
            x: event.x + (Math.random() - 0.5) * 40,
            y: baseY(event.z, 4),
            vx: (Math.random() - 0.5) * 110,
            vy: -20 - Math.random() * 50,
            life: 0.5, maxLife: 0.5,
            size: 5 + Math.random() * 7,
            color: "rgba(236, 218, 186, 0.72)",
          });
        }
      } else if (event.type === "dust") {
        for (let i = 0; i < 4; i += 1) {
          particles.push({
            type: "dust",
            x: event.x + (Math.random() - 0.5) * 24,
            y: baseY(event.z, 4),
            vx: (Math.random() - 0.5) * 60,
            vy: -12 - Math.random() * 26,
            life: 0.34, maxLife: 0.34,
            size: 4 + Math.random() * 5,
            color: "rgba(226, 208, 178, 0.6)",
          });
        }
      } else if (event.type === "special") {
        for (let i = 0; i < 20; i += 1) {
          const angle = (Math.PI * 2 * i) / 20;
          particles.push({
            type: "spark",
            x: event.x, y: baseY(event.z, 40),
            vx: Math.cos(angle) * (200 + Math.random() * 120),
            vy: Math.sin(angle) * 120,
            life: 0.55, maxLife: 0.55,
            size: 5,
            color: i % 2 ? "#ffe08a" : "#ff9a5c",
          });
        }
        particles.push({
          type: "ring",
          x: event.x, y: baseY(event.z, 36),
          vx: 0, vy: 0,
          life: 0.4, maxLife: 0.4, size: 18, color: "#ffd25e",
        });
      } else if (event.type === "pickup" || event.type === "heal" || event.type === "star") {
        const count = event.type === "star" ? 26 : 8;
        for (let i = 0; i < count; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          particles.push({
            type: "star",
            x: event.x ?? state.players[0].x,
            y: baseY(event.z ?? 0.6, 70),
            vx: Math.cos(angle) * (60 + Math.random() * 140),
            vy: Math.sin(angle) * (60 + Math.random() * 120) - 40,
            life: 0.8, maxLife: 0.8,
            size: 4 + Math.random() * 4,
            color: "#fff0b8",
          });
        }
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.type === "dust") {
        particle.vy += 40 * dt;
        particle.size += 20 * dt;
      } else if (particle.type === "spark" || particle.type === "dot") {
        particle.vy += 420 * dt;
      } else if (particle.type === "star") {
        particle.vy += 180 * dt;
      }
    }
    for (let i = stars.length - 1; i >= 0; i -= 1) {
      stars[i].life -= dt;
      if (stars[i].life <= 0) stars.splice(i, 1);
    }
  }

  function drawParticles(state) {
    ctx.clearRect(0, 0, width, height);
    const cameraX = state.cameraX;
    for (const particle of particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      const x = particle.x - cameraX;
      if (x < -30 || x > width + 30) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      if (particle.type === "ring") {
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, particle.y, particle.size + (1 - alpha) * 46, 0, Math.PI * 2);
        ctx.stroke();
      } else if (particle.type === "star") {
        drawStar(x, particle.y, particle.size * (0.6 + alpha * 0.6), particle.color, alpha);
      } else if (particle.type === "spark") {
        ctx.save();
        ctx.translate(x, particle.y);
        ctx.rotate(Math.atan2(particle.vy, particle.vx));
        ctx.fillRect(-particle.size * 1.6, -particle.size * 0.32, particle.size * 3.2, particle.size * 0.64);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const star of stars) {
      const alpha = clamp(star.life / star.maxLife, 0, 1);
      drawStar(star.x, star.y, star.size, star.color, alpha);
    }
    ctx.globalAlpha = 1;
  }

  function drawStar(x, y, size, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI / 4) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? size : size * 0.42;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function triggerFlash() {
    flash.classList.remove("is-on");
    void flash.offsetWidth;
    flash.classList.add("is-on");
  }

  function setLocale(next) {
    locale = next;
    for (const entry of fighters.values()) {
      if (entry.tag && !entry.tag.hidden) {
        const fighter = null;
        // 标签文本由下一帧 sync 覆盖，无需重建元素。
        void fighter;
      }
    }
  }

  function frame(state, events, dt) {
    if (!state) return;
    setChapter(state.spec ? state.spec.chapter : 3);
    syncFighter(state.players[0]);
    if (state.players[1]) syncFighter(state.players[1]);
    else if (fighters.has(1) && !state.players[1]) {
      const entry = fighters.get(1);
      entry.node.remove();
      fighters.delete(1);
    }
    for (const enemy of state.enemies) {
      if (enemy.removeT > 0 && enemy.state === "down") continue;
      syncFighter(enemy);
    }
    for (const item of state.items) syncItem(item);
    removeStale(state);

    const cam = state.cameraX;
    shake = state.fx?.shake ?? 0;
    const shakeX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake > 0 ? (Math.random() - 0.5) * shake * 0.6 : 0;
    camera.style.transform = `translate(${-cam + shakeX}px, ${shakeY}px)`;
    skyline.style.transform = `translateX(${-cam * 0.34}px)`;

    spawnParticles(events, state);
    if (events.some((event) => event.type === "special" || event.type === "bossDown")) triggerFlash();
    updateParticles(dt);
    drawParticles(state);
  }

  return { frame, setStageScale, setChapter, setLocale, resizeCanvas };
}
