import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Pure static SPA: TanStack Router (client-only) + React + Tailwind.
// No SSR / Nitro / server — output in `dist/` is deployable to any static host.
export default defineConfig({
  // Deployed as a subdirectory of the main site: https://doin.win/sudoku/
  base: "/sudoku/",
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    tailwindcss(),
    viteReact(),
  ],
});
