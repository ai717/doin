import type { Difficulty, Puzzle } from "./types.ts";
import { generatePuzzle } from "./generate.ts";

export function generatePuzzleAsync(
  difficulty: Difficulty,
  seed: string,
): Promise<Puzzle> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return Promise.resolve(generatePuzzle(difficulty, seed));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    try {
      const worker = new Worker(new URL("./generate.worker.ts", import.meta.url), {
        type: "module",
      });
      const timer = setTimeout(() => {
        worker.terminate();
        finish(() => {
          try {
            resolve(generatePuzzle(difficulty, seed));
          } catch (err) {
            reject(err);
          }
        });
      }, 6000);
      worker.onmessage = (e: MessageEvent<{ ok: boolean; puzzle?: Puzzle; error?: string }>) => {
        clearTimeout(timer);
        worker.terminate();
        finish(() => {
          if (e.data.ok && e.data.puzzle) resolve(e.data.puzzle);
          else resolve(generatePuzzle(difficulty, seed));
        });
      };
      worker.onerror = () => {
        clearTimeout(timer);
        worker.terminate();
        finish(() => resolve(generatePuzzle(difficulty, seed)));
      };
      worker.postMessage({ difficulty, seed });
    } catch {
      finish(() => resolve(generatePuzzle(difficulty, seed)));
    }
  });
}
