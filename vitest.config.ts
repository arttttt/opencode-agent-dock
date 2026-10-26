import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "vitest/config";

// Under Node, solid-js resolves to its server build, where signals never
// notify: a test of reactivity would pass or fail for the wrong reason. The
// TUI runs the client build (OpenTUI's Bun plugin swaps it in), so tests do too.
// Inlined, so solid-js/store's own import of solid-js takes the alias as well:
// left to Node, it would load the server build, a second instance.
const solid = dirname(createRequire(import.meta.url).resolve("solid-js/package.json"));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^solid-js$/, replacement: join(solid, "dist", "solid.js") },
      { find: /^solid-js\/store$/, replacement: join(solid, "store", "dist", "store.js") },
    ],
  },
  test: {
    server: { deps: { inline: [/solid-js/] } },
  },
});
