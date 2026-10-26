/**
 * The npm install, end to end: pack the package, install the tarball into a
 * throwaway node_modules, and load its ./tui entry the way OpenCode 1's TUI
 * does (test/fixtures/load-tui.ts, under Bun — the host's runtime).
 *
 * This is the path 1.0.0 failed on: it shipped raw src/*.tsx, and the host's
 * Solid transform skips files under node_modules, so the import died on
 * @opentui/solid/jsx-dev-runtime. A load from the checkout never shows it.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");
const BUN = join(ROOT, "node_modules", ".bin", "bun");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const work = mkdtempSync(join(tmpdir(), "opencode-agent-dock-install-"));
const install = join(work, "install");
afterAll(() => rmSync(work, { force: true, recursive: true }));

let entry = "";

beforeAll(() => {
  // prepack builds dist/, as `npm publish` does.
  execFileSync("npm", ["pack", "--silent", "--pack-destination", work], { cwd: ROOT, stdio: "pipe" });
  const tarball = readdirSync(work).find((name) => name.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack produced no tarball");

  mkdirSync(install);
  writeFileSync(join(install, "package.json"), JSON.stringify({ private: true }));
  execFileSync("npm", ["install", "--silent", "--no-audit", "--no-fund", "--ignore-scripts", join(work, tarball)], {
    cwd: install,
    stdio: "pipe",
  });
  entry = tuiEntry(join(install, "node_modules", pkg.name));
}, 120_000);

/**
 * The host's own lookup, not Node's resolver: exports["./tui"], a string or
 * its `import`, else `default` (plugin/shared.ts resolvePackageEntrypoint,
 * extractExportValue @v1.19.4).
 */
function tuiEntry(dir: string) {
  const exported = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).exports?.["./tui"];
  const raw = typeof exported === "string" ? exported : (exported?.import ?? exported?.default);
  if (typeof raw !== "string") throw new Error("the installed package has no ./tui export");
  return join(dir, raw);
}

describe("the published package", () => {
  it("resolves ./tui to compiled JS inside the installed package", () => {
    expect(entry).toBe(join(install, "node_modules", pkg.name, "dist", "index.js"));
  });

  it("installs without its own copy of solid-js or @opentui/solid: the host's is the one that renders", () => {
    // A second solid-js would split reactivity between the plugin and the host.
    const require = createRequire(entry);
    expect(() => require.resolve("solid-js")).toThrow();
    expect(() => require.resolve("@opentui/solid")).toThrow();
  });

  it("loads under the host's runtime, registers the dock and renders its slot", () => {
    const out = execFileSync(BUN, [join(ROOT, "test", "fixtures", "load-tui.ts"), entry], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 60_000,
    });

    expect(JSON.parse(out.trim().split("\n").at(-1) ?? "")).toEqual({
      exports: ["default"],
      id: "arttttt.agent-dock",
      tui: "function",
      registered: { slots: ["app_bottom"], intercepts: 1, layers: ["agent-dock.toggle"] },
      rendered: [true],
    });
  });
});
