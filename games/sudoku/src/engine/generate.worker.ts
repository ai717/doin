import { generatePuzzle } from "./generate.ts";
import type { Difficulty } from "./types.ts";

self.onmessage = (e: MessageEvent<{ difficulty: Difficulty; seed: string }>) => {
  const { difficulty, seed } = e.data;
  try {
    const puzzle = generatePuzzle(difficulty, seed);
    self.postMessage({ ok: true, puzzle });
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : "generate failed",
    });
  }
};
