// Run under Bun by test/install.test.ts: loads a TUI entry the way OpenCode 1's
// TUI does (packages/opencode/src/plugin/tui/runtime.ts@v1.19.4) — the
// host's runtime plugin support installed first, then a dynamic import of
// the plugin's entry file — and starts the plugin against a stub API.
//
// This file's own imports resolve from the repo's node_modules, as the
// host's do from its bundle; the plugin's resolve from where it is
// installed, where neither solid-js nor @opentui/solid is.
//
// Prints one JSON line: what loaded, and what the plugin registered.

import { ensureRuntimePluginSupport } from "@opentui/solid/runtime-plugin-support/configure";
import { createRoot } from "solid-js";

// The host also passes its @opentui/keymap modules ({ additional }). Left
// out on purpose: stricter than the host, so a new runtime import the host
// maps only by chance fails here first. Don't add them to make a test pass.
ensureRuntimePluginSupport({});

const entry = process.argv[2];
if (!entry) throw new Error("usage: load-tui.ts <entry file>");

const mod = await import(entry);
const plugin = mod.default;

const registered = { slots: [] as string[], intercepts: 0, layers: [] as string[] };
const disposers: (() => void)[] = [];
const renderers: ((ctx: unknown) => unknown)[] = [];
const ok = async () => ({ data: [] });
const api = {
  client: { app: { log: ok }, session: { children: ok } },
  route: { current: { name: "home" }, navigate: () => {} },
  state: { session: { get: () => undefined, status: () => undefined } },
  event: { on: () => () => {} },
  lifecycle: {
    onDispose: (fn: () => void) => {
      disposers.push(fn);
      return () => {};
    },
  },
  slots: {
    register: (slot: { slots: Record<string, (ctx: unknown) => unknown> }) => {
      registered.slots.push(...Object.keys(slot.slots));
      renderers.push(...Object.values(slot.slots));
      return () => {};
    },
  },
  keymap: {
    intercept: () => {
      registered.intercepts += 1;
      return () => {};
    },
    registerLayer: (layer: { commands?: { name: string }[] }) => {
      registered.layers.push(...(layer.commands ?? []).map((command) => command.name));
      return () => {};
    },
  },
};

await plugin.tui(api, undefined, {});

// Render each slot once: the compiled JSX calls into @opentui/solid, which
// only the host's runtime mapping provides here.
const tone = { text: "#ffffff", textMuted: "#888888", primary: "#00aaff" };
const rendered = createRoot((dispose) => {
  disposers.push(dispose);
  return renderers.map((render) => render({ theme: { current: tone } }) !== undefined);
});
// OpenCode 2 (@opencode/plugin 2.1.4 tui/context.d.ts): the same default's
// `setup`, against a stub context, its slot claim rendered once.
const v2 = { claims: [] as string[], layers: 0, rendered: [] as boolean[] };
const claims: { render: (input: object) => unknown }[] = [];
const context = {
  data: { session: { get: () => undefined, family: () => [], status: () => "idle" } },
  theme: { text: { base: "#ffffff", muted: "#888888", action: { primary: { base: "#00aaff" } } } },
  keymap: { layer: () => void (v2.layers += 1) },
  ui: {
    router: { current: () => ({ type: "home" }), navigate: () => {} },
    slot: (claim: { append?: string; render: (input: object) => unknown }) => {
      v2.claims.push(`append:${claim.append}`);
      claims.push(claim);
      return () => {};
    },
  },
};
const cleanup = createRoot((dispose) => {
  disposers.push(dispose);
  const release = plugin.setup(context);
  v2.rendered = claims.map((claim) => claim.render({}) !== undefined);
  return release;
});
disposers.push(cleanup);

// The dock polls (v1) and ticks (v2): dispose it, as the host does, so Bun can exit.
for (const dispose of disposers) dispose();

console.log(
  JSON.stringify({
    exports: Object.keys(mod),
    id: plugin.id,
    tui: typeof plugin.tui,
    setup: typeof plugin.setup,
    registered,
    rendered,
    v2,
  }),
);
