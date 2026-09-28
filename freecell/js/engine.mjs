export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const SUIT_COLORS = {
  spades: 'black',
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black'
};

export const DIFFICULTY_SEEDS = {
  easy: [164, 257, 1024, 2304, 5218],
  normal: [1, 617, 32114, 11982]
};

export function createCard(suit, rank, id) {
  return {
    id: id !== undefined ? id : `${suit}_${rank}`,
    suit,
    rank,
    color: SUIT_COLORS[suit]
  };
}

export function msRand(seed) {
  let state = seed >>> 0;
  return function () {
    state = (Math.imul(214013, state) + 2531011) & 0x7fffffff;
    return (state >> 16) & 0x7fff;
  };
}

export function dealMicrosoftBoard(dealNumber, difficulty = 'normal') {
  const seed = dealNumber & 0x7fffffff;
  const rand = msRand(seed);

  const deck = [];
  for (let rank = 1; rank <= 13; rank++) {
    for (let s = 0; s < 4; s++) {
      const suit = ['clubs', 'diamonds', 'hearts', 'spades'][s];
      deck.push(createCard(suit, rank));
    }
  }

  let wLeft = 52;
  const shuffled = [];
  for (let i = 0; i < 52; i++) {
    const j = rand() % wLeft;
    shuffled.push(deck[j]);
    deck[j] = deck[wLeft - 1];
    wLeft--;
  }

  // 简单难度：将 4 张 A 自动对调置换到底部（最表层），开局秒开局，易上手
  if (difficulty === 'easy') {
    const aceIndices = [];
    shuffled.forEach((card, idx) => {
      if (card.rank === 1) aceIndices.push(idx);
    });
    // 表面暴露的 4 个位置
    const surfaceIndices = [51, 50, 49, 48];
    aceIndices.forEach((aceIdx, i) => {
      const targetIdx = surfaceIndices[i];
      const temp = shuffled[targetIdx];
      shuffled[targetIdx] = shuffled[aceIdx];
      shuffled[aceIdx] = temp;
    });
  }

  const cascades = [[], [], [], [], [], [], [], []];
  for (let i = 0; i < 52; i++) {
    cascades[i % 8].push(shuffled[i]);
  }

  return cascades;
}

export function getMaxMovableCards(freeCellsCount, emptyCascadesCount, isDestEmptyCascade = false) {
  const effectiveEmptyCascades = isDestEmptyCascade ? Math.max(0, emptyCascadesCount - 1) : emptyCascadesCount;
  return (1 + freeCellsCount) * Math.pow(2, effectiveEmptyCascades);
}

export function isValidCascadeSequence(cards) {
  if (!cards || cards.length === 0) return false;
  for (let i = 0; i < cards.length - 1; i++) {
    const cur = cards[i];
    const next = cards[i + 1];
    if (cur.color === next.color) return false;
    if (cur.rank !== next.rank + 1) return false;
  }
  return true;
}

export function canMoveToFoundation(card, foundationTopCard) {
  if (!foundationTopCard) {
    return card.rank === 1;
  }
  return card.suit === foundationTopCard.suit && card.rank === foundationTopCard.rank + 1;
}

export function canMoveToCascade(card, cascadeTopCard) {
  if (!cascadeTopCard) {
    return true;
  }
  return card.color !== cascadeTopCard.color && card.rank === cascadeTopCard.rank - 1;
}

export class FreeCellEngine {
  constructor(dealNumber = 1, difficulty = 'normal') {
    this.dealNumber = dealNumber;
    this.difficulty = difficulty;
    this.cells = [null, null, null, null];
    this.foundations = [[], [], [], []];
    this.cascades = [[], [], [], [], [], [], [], []];
    this.history = [];
    this.movesCount = 0;
    this.score = 0;
    this.isWon = false;
    this.init(dealNumber, difficulty);
  }

  init(dealNumber, difficulty = 'normal') {
    this.dealNumber = dealNumber;
    this.difficulty = difficulty;
    this.cells = [null, null, null, null];
    this.foundations = [[], [], [], []];
    this.cascades = dealMicrosoftBoard(dealNumber, difficulty);
    this.history = [];
    this.movesCount = 0;
    this.score = 0;
    this.isWon = false;
  }

  getEmptyCellsCount() {
    return this.cells.filter(c => c === null).length;
  }

  getEmptyCascadesCount() {
    return this.cascades.filter(col => col.length === 0).length;
  }

  canMoveSubstack(fromCascadeIndex, startIndex, toCascadeIndex) {
    const col = this.cascades[fromCascadeIndex];
    if (!col || startIndex < 0 || startIndex >= col.length) return false;

    const cardsToMove = col.slice(startIndex);
    if (!isValidCascadeSequence(cardsToMove)) return false;

    const destCol = this.cascades[toCascadeIndex];
    const destTop = destCol.length > 0 ? destCol[destCol.length - 1] : null;
    if (!canMoveToCascade(cardsToMove[0], destTop)) return false;

    const maxMovable = getMaxMovableCards(
      this.getEmptyCellsCount(),
      this.getEmptyCascadesCount(),
      destCol.length === 0
    );

    return cardsToMove.length <= maxMovable;
  }

  moveCards(action) {
    const { from, to, count = 1 } = action;
    const snapshot = this.takeSnapshot();

    let success = false;
    let isFoundation = false;

    if (from.type === 'cell') {
      const card = this.cells[from.index];
      if (!card) return false;

      if (to.type === 'cell') {
        if (this.cells[to.index] === null) {
          this.cells[to.index] = card;
          this.cells[from.index] = null;
          success = true;
        }
      } else if (to.type === 'foundation') {
        const top = this.getFoundationTop(to.index);
        if (canMoveToFoundation(card, top)) {
          this.foundations[to.index].push(card);
          this.cells[from.index] = null;
          success = true;
          isFoundation = true;
        }
      } else if (to.type === 'cascade') {
        const destCol = this.cascades[to.index];
        const top = destCol.length > 0 ? destCol[destCol.length - 1] : null;
        if (canMoveToCascade(card, top)) {
          destCol.push(card);
          this.cells[from.index] = null;
          success = true;
        }
      }
    } else if (from.type === 'cascade') {
      const sourceCol = this.cascades[from.index];
      if (sourceCol.length === 0) return false;

      if (to.type === 'cell') {
        if (count === 1 && this.cells[to.index] === null) {
          const card = sourceCol.pop();
          this.cells[to.index] = card;
          success = true;
        }
      } else if (to.type === 'foundation') {
        if (count === 1) {
          const card = sourceCol[sourceCol.length - 1];
          const top = this.getFoundationTop(to.index);
          if (canMoveToFoundation(card, top)) {
            this.foundations[to.index].push(sourceCol.pop());
            success = true;
            isFoundation = true;
          }
        }
      } else if (to.type === 'cascade') {
        const startIndex = sourceCol.length - count;
        if (this.canMoveSubstack(from.index, startIndex, to.index)) {
          const moving = sourceCol.splice(startIndex, count);
          this.cascades[to.index].push(...moving);
          success = true;
        }
      }
    }

    if (success) {
      this.history.push(snapshot);
      this.movesCount++;
      if (isFoundation) {
        this.score += 100;
      }
      this.checkVictory();
      return true;
    }

    return false;
  }

  undo() {
    if (this.history.length === 0) return false;
    const prev = this.history.pop();
    this.restoreSnapshot(prev);
    this.movesCount++;
    this.score = Math.max(0, this.score - 50);
    this.isWon = false;
    return true;
  }

  getFoundationTop(fIndex) {
    const f = this.foundations[fIndex];
    return f && f.length > 0 ? f[f.length - 1] : null;
  }

  findAutoMoveToFoundation() {
    for (let c = 0; c < 4; c++) {
      const card = this.cells[c];
      if (!card) continue;
      for (let f = 0; f < 4; f++) {
        const top = this.getFoundationTop(f);
        if (canMoveToFoundation(card, top)) {
          return { from: { type: 'cell', index: c }, to: { type: 'foundation', index: f }, card };
        }
      }
    }

    for (let col = 0; col < 8; col++) {
      const cascade = this.cascades[col];
      if (cascade.length === 0) continue;
      const card = cascade[cascade.length - 1];
      for (let f = 0; f < 4; f++) {
        const top = this.getFoundationTop(f);
        if (canMoveToFoundation(card, top)) {
          return { from: { type: 'cascade', index: col }, to: { type: 'foundation', index: f }, card };
        }
      }
    }

    return null;
  }

  findSafeAutoMove() {
    const move = this.findAutoMoveToFoundation();
    if (!move) return null;

    if (move.card.rank <= 2) {
      return move;
    }

    const targetRank = move.card.rank;
    const oppositeColor = move.card.color === 'red' ? 'black' : 'red';
    
    let lowestOppositeRankInFoundations = 13;
    for (let f = 0; f < 4; f++) {
      const top = this.getFoundationTop(f);
      if (!top) {
        lowestOppositeRankInFoundations = 0;
        break;
      }
      if (top.color === oppositeColor) {
        lowestOppositeRankInFoundations = Math.min(lowestOppositeRankInFoundations, top.rank);
      }
    }

    if (lowestOppositeRankInFoundations >= targetRank - 1) {
      return move;
    }

    return null;
  }

  findAnyHintMove() {
    const auto = this.findAutoMoveToFoundation();
    if (auto) return auto;

    for (let fIdx = 0; fIdx < 4; fIdx++) {
      const card = this.cells[fIdx];
      if (!card) continue;
      for (let c = 0; c < 8; c++) {
        const col = this.cascades[c];
        const top = col.length > 0 ? col[col.length - 1] : null;
        if (canMoveToCascade(card, top)) {
          return { from: { type: 'cell', index: fIdx }, to: { type: 'cascade', index: c }, count: 1 };
        }
      }
    }

    for (let src = 0; src < 8; src++) {
      const sCol = this.cascades[src];
      if (sCol.length === 0) continue;

      for (let k = sCol.length - 1; k >= 0; k--) {
        const count = sCol.length - k;
        if (!isValidCascadeSequence(sCol.slice(k))) break;

        for (let dst = 0; dst < 8; dst++) {
          if (src === dst) continue;
          if (this.canMoveSubstack(src, k, dst)) {
            if (sCol.length === count && this.cascades[dst].length === 0) {
              continue;
            }
            return { from: { type: 'cascade', index: src }, to: { type: 'cascade', index: dst }, count };
          }
        }
      }

      const emptyCellIdx = this.cells.findIndex(c => c === null);
      if (emptyCellIdx !== -1) {
        return { from: { type: 'cascade', index: src }, to: { type: 'cell', index: emptyCellIdx }, count: 1 };
      }
    }

    return null;
  }

  checkVictory() {
    let totalInFoundations = 0;
    for (let f = 0; f < 4; f++) {
      totalInFoundations += this.foundations[f].length;
    }
    if (totalInFoundations === 52) {
      this.isWon = true;
    }
    return this.isWon;
  }

  takeSnapshot() {
    return {
      cells: this.cells.map(c => (c ? { ...c } : null)),
      foundations: this.foundations.map(f => f.map(c => ({ ...c }))),
      cascades: this.cascades.map(col => col.map(c => ({ ...c }))),
      movesCount: this.movesCount,
      score: this.score
    };
  }

  restoreSnapshot(snapshot) {
    this.cells = snapshot.cells.map(c => (c ? { ...c } : null));
    this.foundations = snapshot.foundations.map(f => f.map(c => ({ ...c })));
    this.cascades = snapshot.cascades.map(col => col.map(c => ({ ...c })));
    this.movesCount = snapshot.movesCount;
    this.score = snapshot.score;
  }
}
