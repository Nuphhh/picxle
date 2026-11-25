// Vitest settings. Run tests with `npm test` (once) or `npm run test:watch`
// (re-runs on save). Both go through scripts/vitest.mjs — see why there.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Same "@/..." shortcut as tsconfig.json, so tests import code the way the
    // app does. A regex matching "@/" exactly, so it can't catch packages like
    // "@vitest/runner" that also start with "@".
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: {
    // Most tests are plain logic and run in Node. Component tests opt into a
    // fake browser with a `// @vitest-environment jsdom` comment at the top.
    environment: "node",
    include: ["{src,components}/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
