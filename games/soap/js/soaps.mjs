// Static catalog. All display strings are i18n keys; no natural-language text lives here.
// Grid is 10 columns x 7 rows. Core patterns use '#' for the hidden figure cell.

export const GRID_W = 10;
export const GRID_H = 7;

export const MATERIALS = Object.freeze({
  mat_hard: Object.freeze({ id: "mat_hard", freq: 1850, q: 3.2, decay: 0.028, tone: 1.0, key: "mat.hard" }),
  mat_soft: Object.freeze({ id: "mat_soft", freq: 1050, q: 1.8, decay: 0.045, tone: 0.7, key: "mat.soft" }),
  mat_jelly: Object.freeze({ id: "mat_jelly", freq: 2400, q: 5.0, decay: 0.02, tone: 1.35, key: "mat.jelly" }),
});

export const TOOLS = Object.freeze({
  tool_knife: Object.freeze({ id: "tool_knife", width: 1.1, depth: 0.7, chip: "curl", sound: "crisp" }),
  tool_scraper: Object.freeze({ id: "tool_scraper", width: 3.2, depth: 0.28, chip: "flake", sound: "dense" }),
  tool_peeler: Object.freeze({ id: "tool_peeler", width: 1.8, depth: 0.42, chip: "ribbon", sound: "smooth" }),
});

export const TOOL_IDS = Object.freeze(["tool_knife", "tool_scraper", "tool_peeler"]);

const CORE_PATTERNS = Object.freeze({
  star: Object.freeze([
    "...##.....",
    "...##.....",
    "##########",
    ".########.",
    "..######..",
    "..###.###.",
    ".##.....##",
  ]),
  flower: Object.freeze([
    "...##.....",
    "..####....",
    "...##.....",
    "##########",
    "##########",
    "...##.....",
    "..####....",
  ]),
  heart: Object.freeze([
    ".##...##..",
    "####.####.",
    "##########",
    "##########",
    ".########.",
    "..######..",
    "...####...",
  ]),
  paw: Object.freeze([
    "..#..#....",
    ".##..##...",
    ".##..##...",
    "..####....",
    "...####...",
    "..####....",
    ".##..##...",
  ]),
});

export function corePattern(id) {
  return CORE_PATTERNS[id] ?? null;
}

function soap(id, nameKey, family, material, layers, tint, accent, core) {
  return Object.freeze({ id, nameKey, family, material, layers, tint, accent, core: core ?? null });
}

export const SOAPS = Object.freeze([
  soap("soap_classic_white", "soap.classic.white", "classic", "mat_hard", 5, "#f4efe6", "#d9cfc0"),
  soap("soap_classic_pink", "soap.classic.pink", "classic", "mat_hard", 5, "#f6dbe3", "#dfb6c5"),
  soap("soap_classic_blue", "soap.classic.blue", "classic", "mat_hard", 5, "#d6e8f6", "#a9c9e2"),
  soap("soap_classic_mint", "soap.classic.mint", "classic", "mat_hard", 5, "#d9f0e4", "#a8d4bd"),

  soap("soap_jelly_berry", "soap.jelly.berry", "jelly", "mat_jelly", 6, "#e6b4d8", "#c987b6"),
  soap("soap_jelly_citrus", "soap.jelly.citrus", "jelly", "mat_jelly", 6, "#f7e6a8", "#dccb78"),
  soap("soap_jelly_ocean", "soap.jelly.ocean", "jelly", "mat_jelly", 6, "#a8dde3", "#79bcc6"),
  soap("soap_jelly_grape", "soap.jelly.grape", "jelly", "mat_jelly", 6, "#cbb8ea", "#a38dcf"),

  soap("soap_shape_star", "soap.shape.star", "shape", "mat_soft", 7, "#f9d9a8", "#d9b176", "star"),
  soap("soap_shape_flower", "soap.shape.flower", "shape", "mat_soft", 7, "#f3c9d6", "#d69fb3", "flower"),
  soap("soap_shape_heart", "soap.shape.heart", "shape", "mat_soft", 7, "#efb9bd", "#cf929a", "heart"),
  soap("soap_shape_paw", "soap.shape.paw", "shape", "mat_soft", 7, "#d8cbb2", "#b3a283", "paw"),
]);

export const SOAP_IDS = Object.freeze(SOAPS.map((item) => item.id));

export function getSoap(id) {
  return SOAPS.find((item) => item.id === id) ?? SOAPS[0];
}
