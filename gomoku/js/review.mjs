// 对局复盘点评分析器（Post-Game Review）
// 纯函数、DOM-free。遍历对局手数，基于棋型分类诊断关键节点：
// 1) 妙手形成双杀形（冲四活三 / 双活三）
// 2) 关键封堵（成功化解对手四连危机）
// 3) 漏防失误（错失防守点）
// 4) 胜定一击

import {
  BLACK,
  WHITE,
  SIZE,
  rc,
  applyMove,
  createState,
  classifyShape,
  other,
} from "./engine.mjs";

export function analyzeGame(moves = [], winner = null, humanMark = BLACK) {
  if (!Array.isArray(moves) || moves.length === 0) return [];

  const reviews = [];
  let state = createState({ firstPlayer: BLACK });

  // 逐步推演
  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i];
    const player = i % 2 === 0 ? BLACK : WHITE;
    const isHuman = player === humanMark;
    const moveNum = i + 1;
    const [r, c] = rc(move);
    const colLetter = String.fromCharCode(65 + c);
    const rowNum = 15 - r;
    const coordStr = `${colLetter}${rowNum}`;

    // 检查落子前对手是否有必须堵的四
    const opp = other(player);
    let hadOppFour = false;
    for (let p = 0; p < state.board.length; p += 1) {
      if (state.board[p] === opp) {
        const [or, oc] = rc(p);
        const s = classifyShape(state.board, or, oc, opp);
        if (s.fours >= 1) {
          hadOppFour = true;
          break;
        }
      }
    }

    // 落子
    const next = applyMove(state, move);
    if (next === state) break;

    const shape = classifyShape(next.board, r, c, player);

    // 判定 1：最终制胜手
    if (i === moves.length - 1 && winner === player) {
      reviews.push({
        step: moveNum,
        player,
        isHuman,
        type: "win",
        coord: coordStr,
        key: isHuman ? "reviewHumanWin" : "reviewAiWin",
      });
      break;
    }

    // 判定 2：双杀形（冲四活三 或 双活三）
    if ((shape.fours >= 1 && shape.openThrees >= 1) || shape.openThrees >= 2) {
      reviews.push({
        step: moveNum,
        player,
        isHuman,
        type: "double_threat",
        coord: coordStr,
        key: isHuman ? "reviewHumanDoubleThreat" : "reviewAiDoubleThreat",
      });
    }
    // 判定 3：关键封堵（成功瓦解对手四连）
    else if (hadOppFour) {
      reviews.push({
        step: moveNum,
        player,
        isHuman,
        type: "defense",
        coord: coordStr,
        key: isHuman ? "reviewHumanBlock" : "reviewAiBlock",
      });
    }
    // 判定 4：积极进攻（形成冲四）
    else if (shape.fours >= 1 && reviews.length < 3) {
      reviews.push({
        step: moveNum,
        player,
        isHuman,
        type: "attack_four",
        coord: coordStr,
        key: isHuman ? "reviewHumanFour" : "reviewAiFour",
      });
    }

    state = next;
  }

  // 若局数过短或平和，补充开局平稳点评
  if (reviews.length === 0) {
    reviews.push({
      step: 1,
      player: BLACK,
      isHuman: humanMark === BLACK,
      type: "balanced",
      coord: "天元",
      key: "reviewBalanced",
    });
  }

  // 取最具代表性的 2~3 条
  return reviews.slice(0, 3);
}
