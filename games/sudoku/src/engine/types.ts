export type Difficulty = "intro" | "easy" | "medium" | "hard" | "expert";

export const DIFFICULTIES: Difficulty[] = [
  "intro",
  "easy",
  "medium",
  "hard",
  "expert",
];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  intro: "入门",
  easy: "简单",
  medium: "中等",
  hard: "困难",
  expert: "专家",
};

export type TechniqueId =
  | "naked-single"
  | "hidden-single"
  | "naked-pair"
  | "hidden-pair"
  | "pointing"
  | "naked-triple"
  | "hidden-triple"
  | "x-wing"
  | "xy-wing"
  | "swordfish"
  | "conflict";

export const TECHNIQUE_RANK: Record<TechniqueId, number> = {
  "naked-single": 0,
  "hidden-single": 1,
  "naked-pair": 2,
  "hidden-pair": 2,
  pointing: 2,
  "naked-triple": 3,
  "hidden-triple": 3,
  "x-wing": 3,
  "xy-wing": 4,
  swordfish: 4,
  conflict: 0,
};

export const TECHNIQUE_LABEL: Record<TechniqueId, string> = {
  "naked-single": "显性唯一",
  "hidden-single": "隐性唯一",
  "naked-pair": "显性数对",
  "hidden-pair": "隐性数对",
  pointing: "区块删减",
  "naked-triple": "显性三数组",
  "hidden-triple": "隐性三数组",
  "x-wing": "X-Wing",
  "xy-wing": "XY-Wing",
  swordfish: "Swordfish",
  conflict: "冲突",
};

export const RANK_TO_DIFFICULTY: Difficulty[] = [
  "intro",
  "easy",
  "medium",
  "hard",
  "expert",
];

export interface Puzzle {
  seed: string;
  difficulty: Difficulty;
  givens: number[];
  solution: number[];
}

export type UnitKind = "row" | "col" | "box";

export interface HintStep {
  technique: TechniqueId;
  message: string;
  units: { kind: UnitKind; index: number }[];
  cells: number[];
  focusCell: number | null;
  digit: number | null;
  placements: { cell: number; digit: number }[];
}

export interface Hint {
  step: HintStep;
  level: 1 | 2 | 3;
}
