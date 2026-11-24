// Match result wording and best-record comparison for Flick Duel.

export function formatTime(seconds) {
  const value = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function turnLabelKey(mode, turn, humanSide) {
  if (mode === "duel") return turn === "south" ? "turnP1" : "turnP2";
  return turn === humanSide ? "turnYou" : "turnAi";
}

export function seatLabelKey(mode, side, humanSide) {
  if (mode === "duel") return side === "south" ? "seatP1" : "seatP2";
  return side === humanSide ? "seatYou" : "seatAi";
}

export function resultTitleKey(mode, winner, humanSide) {
  if (!winner) return "resultTitle";
  if (winner === "draw") return "drawTitle";
  if (mode === "duel") return winner === "south" ? "duelWinSouth" : "duelWinNorth";
  return winner === humanSide ? "winSolo" : "loseSolo";
}

export function reasonKey(reason) {
  return reason === "limit" ? "reasonLimit" : "reasonCleared";
}

export function isNewBest(record, rounds, time) {
  if (!record) return true;
  if (!Number.isFinite(rounds)) return false;
  if (rounds < record.rounds) return true;
  if (rounds > record.rounds) return false;
  return Number.isFinite(time) && time < record.time;
}

export function summarize(state) {
  const counts = { south: 0, north: 0 };
  for (const puck of state.pucks) {
    if (puck.side === "south") counts.south += 1;
    else counts.north += 1;
  }
  return {
    round: state.round,
    maxRounds: state.maxRounds,
    time: state.time,
    counts,
    winner: state.winner,
    reason: state.reason,
  };
}
