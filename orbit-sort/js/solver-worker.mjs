import { solve } from "../solver.mjs?v=33cf6d4ca847";

self.addEventListener("message", ({ data }) => {
  const isAdvisory = data.kind === "solvability";
  const result = solve(data.state, isAdvisory
    ? { nodeLimit: 2_000_000, timeLimitMs: 5_000 }
    : { nodeLimit: 250_000, timeLimitMs: 900 });
  self.postMessage({ kind: data.kind ?? "hint", requestId: data.requestId, status: result.status, actions: result.actions });
});
