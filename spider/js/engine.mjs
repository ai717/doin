// Spider Solitaire Core Game Engine
// Pure functional rules logic, 100% DOM-free and deterministic.

export const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'];

export const SUIT_SYMBOLS = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦'
};

export const SUIT_COLORS = {
  spades: 'black',
  hearts: 'red',
  clubs: 'black',
  diamonds: 'red'
};

export const RANK_NAMES = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K'
};

/**
 * Deterministic PRNG using mulberry32.
 * @param {number} seed
 * @returns {() => number} Returns float in [0, 1)
 */
export function mulberry32(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a unique card object.
 */
export function createCard(suit, rank, id, faceUp = false) {
  return {
    id: id || `${suit}_${rank}`,
    suit,
    rank,
    faceUp
  };
}

/**
 * Generates the full 104-card deck based on suit count.
 * @param {number} suitCount 1, 2, 3, or 4
 * @returns {Array} 104 card objects
 */
export function generateDeck(suitCount = 2) {
  let suitPlan = [];
  if (suitCount === 1) {
    // 8 runs of Spades
    suitPlan = Array(8).fill('spades');
  } else if (suitCount === 2) {
    // 4 runs of Spades, 4 runs of Hearts
    suitPlan = ['spades', 'spades', 'spades', 'spades', 'hearts', 'hearts', 'hearts', 'hearts'];
  } else if (suitCount === 3) {
    // 3 Spades, 3 Hearts, 2 Clubs = 8 runs
    suitPlan = ['spades', 'spades', 'spades', 'hearts', 'hearts', 'hearts', 'clubs', 'clubs'];
  } else {
    // 4 suits: 2 of each = 8 runs
    suitPlan = ['spades', 'spades', 'hearts', 'hearts', 'clubs', 'clubs', 'diamonds', 'diamonds'];
  }

  const deck = [];
  let uid = 0;
  for (const suit of suitPlan) {
    for (let rank = 1; rank <= 13; rank++) {
      uid++;
      deck.push(createCard(suit, rank, `${suit}_${rank}_${uid}`, false));
    }
  }
  return deck;
}

/**
 * Shuffles an array in place using Fisher-Yates with a given PRNG function.
 */
export function shuffleArray(arr, prng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

/**
 * Deep clones cards or column structures for undo snapshots.
 */
export function cloneCards(cards) {
  return cards.map((c) => ({ ...c }));
}

export function cloneColumns(columns) {
  return columns.map((col) => cloneCards(col));
}

export class SpiderEngine {
  /**
   * @param {Object} options
   * @param {number} options.seed PRNG seed
   * @param {number} options.suitCount 1, 2, 3, or 4
   */
  constructor({ seed = 12345, suitCount = 2 } = {}) {
    this.seed = seed;
    this.suitCount = suitCount;
    this.columns = [[], [], [], [], [], [], [], [], [], []];
    this.stock = [];
    this.completedRuns = [];
    this.history = [];
    this.movesCount = 0;
    this.init(seed, suitCount);
  }

  init(seed = this.seed, suitCount = this.suitCount) {
    this.seed = seed;
    this.suitCount = suitCount;
    this.columns = [[], [], [], [], [], [], [], [], [], []];
    this.stock = [];
    this.completedRuns = [];
    this.history = [];
    this.movesCount = 0;

    const prng = mulberry32(seed);
    const deck = generateDeck(suitCount);
    shuffleArray(deck, prng);

    // Initial deal:
    // Columns 0-3: 6 cards each (top 1 face up)
    // Columns 4-9: 5 cards each (top 1 face up)
    // Total on tableau = 4 * 6 + 6 * 5 = 54 cards
    for (let c = 0; c < 10; c++) {
      const count = c < 4 ? 6 : 5;
      for (let i = 0; i < count; i++) {
        const card = deck.pop();
        card.faceUp = i === count - 1;
        this.columns[c].push(card);
      }
    }

    // Remaining 50 cards go to the stock (5 deals of 10)
    while (deck.length > 0) {
      const card = deck.pop();
      card.faceUp = false;
      this.stock.push(card);
    }

    // Check if any initial deals form complete runs (very rare, but keeps invariant safe)
    this.checkAndClearRuns();
  }

  saveSnapshot() {
    return {
      columns: cloneColumns(this.columns),
      stock: cloneCards(this.stock),
      completedRuns: cloneCards(this.completedRuns),
      movesCount: this.movesCount
    };
  }

  /**
   * Checks if a sub-sequence in a column is a valid movable run:
   * all cards must be face-up, same suit, and ranks decreasing by 1.
   */
  isMovableSequence(column, startIndex) {
    if (!column || startIndex < 0 || startIndex >= column.length) return false;
    const first = column[startIndex];
    if (!first.faceUp) return false;

    for (let i = startIndex; i < column.length - 1; i++) {
      const current = column[i];
      const next = column[i + 1];
      if (!current.faceUp || !next.faceUp) return false;
      if (current.suit !== next.suit) return false;
      if (current.rank !== next.rank + 1) return false;
    }
    return true;
  }

  /**
   * Returns an array of start indices in column that can be legally moved.
   */
  getMovableIndices(colIndex) {
    const col = this.columns[colIndex];
    if (!col || col.length === 0) return [];
    const result = [];
    for (let i = col.length - 1; i >= 0; i--) {
      if (!col[i].faceUp) break;
      if (this.isMovableSequence(col, i)) {
        result.unshift(i);
      } else {
        break;
      }
    }
    return result;
  }

  /**
   * Tests if sequence starting at startIndex in fromCol can move to toCol.
   */
  canMove(fromCol, startIndex, toCol) {
    if (fromCol === toCol) return false;
    if (fromCol < 0 || fromCol >= 10 || toCol < 0 || toCol >= 10) return false;

    const sourceCol = this.columns[fromCol];
    if (!this.isMovableSequence(sourceCol, startIndex)) return false;

    const movingCard = sourceCol[startIndex];
    const destCol = this.columns[toCol];

    if (destCol.length === 0) {
      return true; // Any movable sequence can move to empty column
    }

    const destCard = destCol[destCol.length - 1];
    if (!destCard.faceUp) return false;

    // Must be rank + 1 (any suit)
    return destCard.rank === movingCard.rank + 1;
  }

  /**
   * Executes a move from fromCol (starting at startIndex) to toCol.
   * Returns { success: boolean, clearedRuns: Array, flippedCard: Object|null }
   */
  move(fromCol, startIndex, toCol) {
    if (!this.canMove(fromCol, startIndex, toCol)) {
      return { success: false, clearedRuns: [], flippedCard: null };
    }

    this.history.push(this.saveSnapshot());

    const sourceCol = this.columns[fromCol];
    const movingCards = sourceCol.splice(startIndex);
    const destCol = this.columns[toCol];
    destCol.push(...movingCards);

    let flippedCard = null;
    if (sourceCol.length > 0) {
      const topCard = sourceCol[sourceCol.length - 1];
      if (!topCard.faceUp) {
        topCard.faceUp = true;
        flippedCard = topCard;
      }
    }

    this.movesCount++;

    const clearedRuns = this.checkAndClearRunsInColumn(toCol);

    return {
      success: true,
      clearedRuns,
      flippedCard
    };
  }

  /**
   * Deals 1 card to each column from stock.
   * Returns { success: boolean, cardsDealt: Array, clearedRuns: Array }
   */
  dealStock() {
    if (this.stock.length < 10) {
      return { success: false, cardsDealt: [], clearedRuns: [] };
    }

    this.history.push(this.saveSnapshot());

    const cardsDealt = [];
    for (let c = 0; c < 10; c++) {
      const card = this.stock.pop();
      card.faceUp = true;
      this.columns[c].push(card);
      cardsDealt.push({ colIndex: c, card });
    }

    this.movesCount++;

    const clearedRuns = this.checkAndClearRuns();

    return {
      success: true,
      cardsDealt,
      clearedRuns
    };
  }

  /**
   * Checks a specific column for a complete 13-card sequence (K to A, same suit).
   * If found, removes it and increments completedRuns.
   */
  checkAndClearRunsInColumn(colIndex) {
    const col = this.columns[colIndex];
    if (!col || col.length < 13) return [];

    // Check last 13 cards
    const startIndex = col.length - 13;
    const firstCard = col[startIndex];
    if (!firstCard.faceUp || firstCard.rank !== 13) return [];

    const suit = firstCard.suit;
    for (let i = 1; i < 13; i++) {
      const c = col[startIndex + i];
      if (!c.faceUp || c.suit !== suit || c.rank !== 13 - i) {
        return [];
      }
    }

    // Complete run found!
    const runCards = col.splice(startIndex, 13);
    this.completedRuns.push(runCards);

    // If leftover cards in column, flip the top card if hidden
    let flippedCard = null;
    if (col.length > 0) {
      const topCard = col[col.length - 1];
      if (!topCard.faceUp) {
        topCard.faceUp = true;
        flippedCard = topCard;
      }
    }

    return [{
      colIndex,
      suit,
      cards: runCards,
      flippedCard
    }];
  }

  checkAndClearRuns() {
    const allCleared = [];
    for (let c = 0; c < 10; c++) {
      const cleared = this.checkAndClearRunsInColumn(c);
      if (cleared.length > 0) {
        allCleared.push(...cleared);
      }
    }
    return allCleared;
  }

  undo() {
    if (this.history.length === 0) return false;
    const snap = this.history.pop();
    this.columns = snap.columns;
    this.stock = snap.stock;
    this.completedRuns = snap.completedRuns;
    this.movesCount = snap.movesCount;
    return true;
  }

  get isWon() {
    return this.completedRuns.length === 8;
  }

  get remainingStockDeals() {
    return Math.floor(this.stock.length / 10);
  }

  /**
   * Finds the best auto-move target for a given card in a column (e.g. on double-click).
   */
  findSmartMove(fromCol, cardIndex) {
    if (!this.isMovableSequence(this.columns[fromCol], cardIndex)) return null;

    const movingCard = this.columns[fromCol][cardIndex];
    let bestTarget = null;
    let bestScore = -Infinity;

    for (let toCol = 0; toCol < 10; toCol++) {
      if (toCol === fromCol) continue;
      if (!this.canMove(fromCol, cardIndex, toCol)) continue;

      const destCol = this.columns[toCol];
      let score = 0;

      if (destCol.length === 0) {
        // Move to empty column
        // Don't move a sequence from an empty-column King if that column has no hidden cards
        if (movingCard.rank === 13 && cardIndex === 0) {
          score = -10;
        } else if (cardIndex > 0 && !this.columns[fromCol][cardIndex - 1].faceUp) {
          score = 60; // Uncovers a hidden card!
        } else {
          score = 20;
        }
      } else {
        const destCard = destCol[destCol.length - 1];
        if (destCard.suit === movingCard.suit) {
          score = 100; // Same-suit match is best!
        } else {
          score = 40; // Cross-suit match
        }

        // Bonus if this move will uncover a hidden card in source
        if (cardIndex > 0 && !this.columns[fromCol][cardIndex - 1].faceUp) {
          score += 50;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestTarget = toCol;
      }
    }

    return bestTarget !== null ? { toCol: bestTarget, score: bestScore } : null;
  }

  /**
   * Calculates a hint for the player:
   * evaluates all legal moves and returns the most strategic one.
   */
  getHint() {
    let bestMove = null;
    let highestScore = -Infinity;

    for (let fromCol = 0; fromCol < 10; fromCol++) {
      const col = this.columns[fromCol];
      if (col.length === 0) continue;

      const movableIndices = this.getMovableIndices(fromCol);
      for (const idx of movableIndices) {
        const smart = this.findSmartMove(fromCol, idx);
        if (!smart) continue;

        const { toCol, score } = smart;
        if (score > highestScore) {
          highestScore = score;
          bestMove = {
            fromCol,
            cardIndex: idx,
            toCol,
            score
          };
        }
      }
    }

    return bestMove;
  }

  /**
   * Serializes current engine state to a plain object for persistent storage.
   */
  serialize() {
    return {
      seed: this.seed,
      suitCount: this.suitCount,
      columns: cloneColumns(this.columns),
      stock: cloneCards(this.stock),
      completedRuns: cloneCards(this.completedRuns),
      movesCount: this.movesCount
    };
  }

  /**
   * Restores engine state from a serialized object.
   */
  deserialize(data) {
    if (!data || !Array.isArray(data.columns) || !Array.isArray(data.stock)) {
      return false;
    }
    this.seed = data.seed || 12345;
    this.suitCount = data.suitCount || 2;
    this.columns = cloneColumns(data.columns);
    this.stock = cloneCards(data.stock);
    this.completedRuns = cloneCards(data.completedRuns || []);
    this.movesCount = data.movesCount || 0;
    this.history = [];
    return true;
  }
}
