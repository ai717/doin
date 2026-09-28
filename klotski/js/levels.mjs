// filepath: games/klotski/js/levels.mjs
// 关卡数据。par = 目标步数，全部由多源 BFS 最优解实算（一步 = 一块滑动一格），
// 保证每关数学上可解且 par 真实可达；50 关 par 严格递增。
// 第 50 关为经典「横刀立马」（最优 116 步）。

export const LEVELS = [
  { id: "l1", par: 8, grid: [".ab.", "ABDE", "ABDE", "GGCC", "cdCC"] },
  { id: "l2", par: 9, grid: [".aAB", "DEAB", "DEb.", "GGCC", "cdCC"] },
  { id: "l3", par: 11, grid: [".ABa", "bABc", ".GGd", "CCDE", "CCDE"] },
  { id: "l4", par: 12, grid: [".ABa", "DABE", "Db.E", "CCGG", "CCcd"] },
  { id: "l5", par: 14, grid: ["aABD", "EABD", "EbCC", "GGCC", "c.d."] },
  { id: "l6", par: 16, grid: ["ABab", "ABDE", "CCDE", "CCGG", "c.d."] },
  { id: "l7", par: 18, grid: ["aABD", "EABD", "EbCC", "..CC", "GGcd"] },
  { id: "l8", par: 20, grid: [".ABD", "aABD", "EbCC", "E.CC", "GGcd"] },
  { id: "l9", par: 22, grid: ["aAB.", "DABE", "DCCE", "bCC.", "GGcd"] },
  { id: "l10", par: 24, grid: ["aAB.", "DAB.", "DECC", "bECC", "GGcd"] },
  { id: "l11", par: 26, grid: ["aABD", "bABD", ".CCE", ".CCE", "GGcd"] },
  { id: "l12", par: 28, grid: ["aABD", "bABD", ".CCc", "ECC.", "EGGd"] },
  { id: "l13", par: 30, grid: [".ABD", "aABD", "bCCc", "ECC.", "EGGd"] },
  { id: "l14", par: 32, grid: [".ABa", "DABb", "D.CC", "cECC", "dEGG"] },
  { id: "l15", par: 34, grid: [".abA", "BCCA", "BCCD", "E.cD", "EGGd"] },
  { id: "l16", par: 36, grid: [".abA", "BCCA", "BCCD", "EcdD", "E.GG"] },
  { id: "l17", par: 38, grid: ["abAB", "CCAB", "CCD.", "GGDE", "c.dE"] },
  { id: "l18", par: 40, grid: ["ab.A", "BCCA", "BCC.", "DcdE", "DGGE"] },
  { id: "l19", par: 43, grid: ["A.ab", "ABCC", "cBCC", "DEGG", "DE.d"] },
  { id: "l20", par: 45, grid: ["aA.b", "BACC", "B.CC", "DEGG", "DEcd"] },
  { id: "l21", par: 47, grid: ["AabB", "ACCB", "cCCD", "E.dD", "E.GG"] },
  { id: "l22", par: 49, grid: ["CCab", "CCAB", "GGAB", ".cDE", "d.DE"] },
  { id: "l23", par: 52, grid: ["abCC", "ABCC", "ABGG", ".DEc", ".DEd"] },
  { id: "l24", par: 54, grid: ["CCa.", "CCAb", "GGAB", "cDEB", "dDE."] },
  { id: "l25", par: 56, grid: [".aCC", "A.CC", "AbGG", "BDEc", "BDEd"] },
  { id: "l26", par: 59, grid: ["aACC", ".ACC", ".bGG", "BDEc", "BDEd"] },
  { id: "l27", par: 61, grid: [".ACC", ".ACC", "abGG", "BDEc", "BDEd"] },
  { id: "l28", par: 63, grid: ["aCCA", "bCCA", "cdB.", "DEB.", "DEGG"] },
  { id: "l29", par: 66, grid: [".aCC", "bcCC", "ABDE", "ABDE", "d.GG"] },
  { id: "l30", par: 68, grid: [".aCC", "bcCC", "d.AB", "DEAB", "DEGG"] },
  { id: "l31", par: 70, grid: [".aCC", "A.CC", "AbBD", "EcBD", "EdGG"] },
  { id: "l32", par: 73, grid: [".aCC", "bACC", "BADE", "BcDE", "d.GG"] },
  { id: "l33", par: 75, grid: [".ACC", "aACC", "b.BD", "EcBD", "EdGG"] },
  { id: "l34", par: 78, grid: [".aCC", "AbCC", "AB.c", "dBDE", "GGDE"] },
  { id: "l35", par: 80, grid: [".aCC", "AbCC", "ABc.", "DBdE", "DGGE"] },
  { id: "l36", par: 82, grid: ["..CC", "aACC", "bAcB", "DEdB", "DEGG"] },
  { id: "l37", par: 85, grid: [".aCC", "bACC", "BADc", "B.DE", "GGdE"] },
  { id: "l38", par: 87, grid: ["..CC", "ABCC", "ABaD", "bcED", "GGEd"] },
  { id: "l39", par: 90, grid: [".aCC", "bcCC", "ABDE", "ABDE", "GGd."] },
  { id: "l40", par: 92, grid: ["..CC", "aACC", "bAGG", "BcDE", "BdDE"] },
  { id: "l41", par: 95, grid: ["..CC", "aACC", "BADE", "BbDE", "GGcd"] },
  { id: "l42", par: 97, grid: [".aCC", "ABCC", "ABGG", "bcDE", ".dDE"] },
  { id: "l43", par: 100, grid: ["..CC", "ABCC", "ABGG", "DEab", "DEcd"] },
  { id: "l44", par: 102, grid: [".ACC", "aACC", "GG.B", "bDEB", "cDEd"] },
  { id: "l45", par: 105, grid: [".ACC", "aACC", "GGB.", "bDBE", "cDdE"] },
  { id: "l46", par: 107, grid: [".CCA", "aCCA", "BGGD", "BbED", "c.Ed"] },
  { id: "l47", par: 110, grid: [".CCA", "BCCA", "BGG.", "aDbE", "cDdE"] },
  { id: "l48", par: 112, grid: [".ACC", "BACC", "BDa.", "EDbc", "EdGG"] },
  { id: "l49", par: 115, grid: [".ACC", "aACC", "bcGG", "BDdE", "BD.E"] },
  { id: "l50", par: 116, grid: ["ACCB", "ACCB", "DGGE", "DabE", "c..d"] },
];

export const LEVEL_COUNT = LEVELS.length;

/** 难度分档（与 i18n 的 diff.* 对应） */
export function difficultyOf(par) {
  if (par <= 25) return "easy";
  if (par <= 60) return "normal";
  if (par <= 100) return "hard";
  return "expert";
}

export function levelAt(index) {
  const safe = Number.isInteger(index) ? index : 0;
  const clamped = Math.min(LEVEL_COUNT - 1, Math.max(0, safe));
  return LEVELS[clamped];
}

export function levelIndexById(id) {
  const index = LEVELS.findIndex((level) => level.id === id);
  return index < 0 ? 0 : index;
}

export function levelById(id) {
  return LEVELS[levelIndexById(id)];
}
