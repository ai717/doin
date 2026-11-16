// game.mjs —— DOM-free 状态机控制器：接收 UI 意图，调度 engine，返回动作结果（渲染/音效依据）。
// 双轨（en/cn）x 三模式（daily/practice/duel）各自独立进度，切换互不干扰、不重置。

import * as engine from "./engine.mjs";
import { EN_ANSWERS, CN_IDIOMS } from "./wordlists.mjs";

function answerList(track) {
  return track === engine.TRACKS.CN ? CN_IDIOMS : EN_ANSWERS;
}

function makeCore(kind, track, answer, extra = {}) {
  return {
    kind,
    track,
    answer,
    players: [engine.createRound({ track, answer })],
    active: 0,
    done: false,
    winner: null, // duel: 0 / 1；-1 = 平局；solo 恒为 0
    day: extra.day ?? null,
    seed: extra.seed ?? null,
  };
}

function makeDuelCore(kind, track, answer, day) {
  const core = makeCore(kind, track, answer, { day });
  core.players.push(engine.createRound({ track, answer }));
  return core;
}

export function createGame() {
  const state = {
    track: engine.TRACKS.EN,
    mode: engine.MODES.DAILY,
    cores: {
      en: { daily: null, practice: null, duel: null },
      cn: { daily: null, practice: null, duel: null },
    },
  };

  const api = {
    state,
    track: () => state.track,
    mode: () => state.mode,
    core: () => state.cores[state.track][state.mode],
    coreOf: (track, mode) => state.cores[track][mode],

    switchTrack(track) {
      if (track !== engine.TRACKS.EN && track !== engine.TRACKS.CN) return false;
      state.track = track;
      return true;
    },
    switchMode(mode) {
      if (!Object.values(engine.MODES).includes(mode)) return false;
      state.mode = mode;
      return true;
    },

    // 惰性建局：保证切到任意轨道/模式时立即有可玩盘面（Instant Play）。
    // 对抗局单局一次性：已结束的对抗核在同日重进时自动开新局；daily 保留终局核供结果回看。
    ensureCore(track = state.track, mode = state.mode, dayKey = null) {
      const slot = state.cores[track][mode];
      if (slot && (!dayKey || slot.day === dayKey) && !(mode === engine.MODES.DUEL && slot.done)) return slot;
      const answer =
        mode === engine.MODES.DAILY && dayKey
          ? engine.pickDaily(answerList(track), dayKey)
          : engine.randomAnswer(track);
      const core = mode === engine.MODES.DUEL ? makeDuelCore(mode, track, answer, dayKey) : makeCore(mode, track, answer, { day: dayKey, seed: mode === engine.MODES.PRACTICE ? engine.randomSeed() : null });
      state.cores[track][mode] = core;
      return core;
    },

    // 用存档重建（每日 / 双人）：day 不匹配或损坏 -> 由调用方决定新建
    restoreDaily(track, dayKey, saved) {
      if (saved && saved.day === dayKey) {
        const answer = engine.pickDaily(answerList(track), dayKey);
        const round = engine.replayRound({ track, answer, guesses: saved.guesses, hint: saved.hint });
        const core = makeCore(engine.MODES.DAILY, track, answer, { day: dayKey });
        core.players = [round];
        core.done = round.status !== engine.STATUS.PLAYING;
        state.cores[track].daily = core;
        return core;
      }
      return api.ensureCore(track, engine.MODES.DAILY, dayKey);
    },
    restoreDuel(track, dayKey, saved) {
      if (saved && saved.day === dayKey && saved.done !== true) {
        const answer = engine.pickDaily(answerList(track), dayKey);
        const core = makeDuelCore(engine.MODES.DUEL, track, answer, dayKey);
        core.players = saved.players.map((guesses) => engine.replayRound({ track, answer, guesses }));
        if (core.players.length < 2) core.players.push(engine.createRound({ track, answer }));
        core.active = saved.active;
        core.done = false;
        core.winner = null;
        state.cores[track].duel = core;
        return core;
      }
      return api.ensureCore(track, engine.MODES.DUEL, dayKey);
    },

    newPractice(track = state.track, seed = null) {
      const usedSeed = seed === null ? engine.randomSeed() : seed >>> 0;
      const answer = engine.pickBySeed(answerList(track), usedSeed);
      const core = makeCore(engine.MODES.PRACTICE, track, answer, { seed: usedSeed });
      state.cores[track].practice = core;
      return core;
    },

    activeRound() {
      const core = api.core();
      return core.players[core.active];
    },

    typeChar(ch) {
      const core = api.core();
      if (!core || core.done) return { ok: false };
      const round = core.players[core.active];
      return { ok: engine.typeChar(round, ch) };
    },
    backspace() {
      const core = api.core();
      if (!core || core.done) return { ok: false };
      return { ok: engine.backspace(core.players[core.active]) };
    },

    // 提示：揭示答案中一个未命中字符（每局一次）。双人对抗禁用；返回 null = 不可用/已用。
    useHint() {
      const core = api.core();
      if (!core || core.done || core.kind === engine.MODES.DUEL) return null;
      return engine.useHint(core.players[core.active]);
    },

    // 提交：null = 词不在库/未满行/终局（UI 静默忽略或行内提示，不消耗机会）
    submitGuess() {
      const core = api.core();
      if (!core || core.done) return null;
      const res = engine.submit(core.players[core.active]);
      if (!res) return null;

      const out = { core, rowIndex: res.rowIndex, status: res.status, finished: null, flipped: false };
      if (core.kind === engine.MODES.DUEL) {
        if (res.status === engine.STATUS.WON) {
          core.done = true;
          core.winner = core.active;
        } else {
          const other = 1 - core.active;
          const otherLost = core.players[other].status === engine.STATUS.LOST;
          if (core.players[core.active].status === engine.STATUS.LOST) {
            if (otherLost) {
              core.done = true;
              core.winner = -1;
            } else {
              core.active = other; // 轮换（对方仍在局中）
            }
          }
        }
        if (core.done) out.finished = { kind: core.kind, winner: core.winner, turns: core.players.map((r) => r.rows.length) };
      } else if (res.status !== engine.STATUS.PLAYING) {
        core.done = true;
        core.winner = 0;
        out.finished = {
          kind: core.kind,
          won: res.status === engine.STATUS.WON,
          guesses: core.players[0].rows.length,
          answer: core.answer,
        };
      }
      return out;
    },

    // 派生数据
    worksheet() {
      const core = api.core();
      const round = core.players[core.active];
      return {
        chances: engine.chancesLeft(round),
        rowsDone: round.rows.length,
        players: core.players.length,
      };
    },
  };

  return api;
}
