// Level catalogue. Data only: string keys everywhere, zero display text.
// Six vehicle jobs and six home jobs (a 50/50 mix to avoid theme fatigue).
// Each layer is a normalized coverage amount in [0,1]; the engine expands it
// into a deterministic per-cell stain field using the level seed.

export const CHAPTERS = [
  { id: "chapter_car", icon: "car" },
  { id: "chapter_home", icon: "home" },
];

export const TOOLS = ["tool_jet", "tool_foam", "tool_brush", "tool_squeegee"];
export const STAINS = ["stain_dust", "stain_grease", "stain_stubborn"];

export const LEVELS = [
  { id: "level_sedan", chapter: "chapter_car", shape: "sedan", seed: 101, base: "#5aa9e6", layers: { stain_dust: 0.75, stain_grease: 0.30, stain_stubborn: 0.10 } },
  { id: "level_suv", chapter: "chapter_car", shape: "suv", seed: 102, base: "#3f7d5a", layers: { stain_dust: 0.82, stain_grease: 0.38, stain_stubborn: 0.16 } },
  { id: "level_van", chapter: "chapter_car", shape: "van", seed: 103, base: "#e8e2d4", layers: { stain_dust: 0.86, stain_grease: 0.42, stain_stubborn: 0.20 } },
  { id: "level_sports", chapter: "chapter_car", shape: "sports", seed: 104, base: "#e0524a", layers: { stain_dust: 0.72, stain_grease: 0.46, stain_stubborn: 0.24 } },
  { id: "level_pickup", chapter: "chapter_car", shape: "pickup", seed: 105, base: "#d99a3c", layers: { stain_dust: 0.90, stain_grease: 0.50, stain_stubborn: 0.28 } },
  { id: "level_bus", chapter: "chapter_car", shape: "bus", seed: 106, base: "#4f9f9a", layers: { stain_dust: 0.94, stain_grease: 0.56, stain_stubborn: 0.32 } },
  { id: "level_sofa", chapter: "chapter_home", shape: "sofa", seed: 201, base: "#b5654a", layers: { stain_dust: 0.78, stain_grease: 0.34, stain_stubborn: 0.14 } },
  { id: "level_carpet", chapter: "chapter_home", shape: "carpet", seed: 202, base: "#7a6ea8", layers: { stain_dust: 0.88, stain_grease: 0.44, stain_stubborn: 0.22 } },
  { id: "level_stove", chapter: "chapter_home", shape: "stove", seed: 203, base: "#8d949c", layers: { stain_dust: 0.70, stain_grease: 0.62, stain_stubborn: 0.30 } },
  { id: "level_bathtub", chapter: "chapter_home", shape: "bathtub", seed: 204, base: "#dfe6ea", layers: { stain_dust: 0.74, stain_grease: 0.40, stain_stubborn: 0.18 } },
  { id: "level_table", chapter: "chapter_home", shape: "table", seed: 205, base: "#a9743f", layers: { stain_dust: 0.82, stain_grease: 0.48, stain_stubborn: 0.26 } },
  { id: "level_window", chapter: "chapter_home", shape: "window", seed: 206, base: "#8fc5d6", layers: { stain_dust: 0.80, stain_grease: 0.36, stain_stubborn: 0.34 } },
];

export const LEVEL_IDS = LEVELS.map((level) => level.id);

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function chapterLevels(chapterId) {
  return LEVELS.filter((level) => level.chapter === chapterId);
}
