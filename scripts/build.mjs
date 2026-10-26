// Build — compiles src/ to dist/ the way OpenCode's TUI compiles a plugin
// it loads from a local path: Solid's universal JSX transform for
// @opentui/solid, then TypeScript stripped (@opentui/solid
// scripts/solid-transform.js).
//
// Why ship compiled JS: an npm install lives under node_modules, and the
// host's Solid transform skips every file there, so raw .tsx gets Bun's
// default JSX, whose @opentui/solid/jsx-dev-runtime import the host never
// provides. Compiled output imports only solid-js and @opentui/solid, which
// the host maps to its own copies.

import { transformAsync } from "@babel/core";
import ts from "@babel/preset-typescript";
import solid from "babel-preset-solid";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const isSource = (name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts");

async function sources(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sources(path)));
    else if (isSource(entry.name)) out.push(path);
  }
  return out;
}

async function compile(file) {
  const presets = [];
  if (file.endsWith(".tsx")) presets.push([solid, { moduleName: "@opentui/solid", generate: "universal" }]);
  presets.push([ts]);
  const result = await transformAsync(await readFile(file, "utf8"), {
    filename: file,
    configFile: false,
    babelrc: false,
    presets,
  });
  if (!result?.code) throw new Error(`build: no output for ${relative(ROOT, file)}`);
  return result.code;
}

await rm(DIST, { force: true, recursive: true });
for (const file of await sources(SRC)) {
  const target = join(DIST, relative(SRC, file)).replace(/\.tsx?$/, ".js");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${await compile(file)}\n`);
}
