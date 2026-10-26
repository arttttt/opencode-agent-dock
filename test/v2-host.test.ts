// The OpenCode 2 setup against a fake plugin context: where it claims a place,
// what its keymap layers bind, how the dock takes and gives back the keys, and
// that its cleanup releases everything. Rendering runs in install.test.ts,
// under the host's runtime.

import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TOGGLE } from "../src/constants.js";
import { openCodeV2Setup } from "../src/hosts/opencode-v2.js";
import type { V2Context, V2KeymapLayer, V2Route, V2Session, V2SlotClaim } from "../src/v2/host.js";

const ROOT = "ses_root";
const tokens = { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } };
const session = (id: string, parentID?: string): V2Session => ({ id, parentID, title: id, tokens, time: { created: 1 } });

function context(sessions: V2Session[], running: string[]) {
  const claims: V2SlotClaim[] = [];
  const released = vi.fn();
  const layers: (() => V2KeymapLayer)[] = [];
  const [route] = createSignal<V2Route>({ type: "session", sessionID: ROOT });
  const navigate = vi.fn();
  const byId = new Map(sessions.map((item) => [item.id, item]));

  const ctx: V2Context = {
    data: {
      session: {
        get: (id) => byId.get(id),
        family: () => [...byId.keys()],
        status: (id) => (running.includes(id) ? "running" : "idle"),
      },
    },
    theme: { text: { base: "#fff", muted: "#888", action: { primary: { base: "#0af" } } } },
    keymap: { layer: (factory) => void layers.push(factory) },
    ui: {
      router: { current: route, navigate },
      slot: (claim) => {
        claims.push(claim);
        return released;
      },
    },
  };
  return { ctx, claims, released, layers, navigate };
}

/** The layer's commands as the keymap would see them, `enabled` resolved. */
function resolve(factory: () => V2KeymapLayer) {
  const layer = factory();
  const enabled = typeof layer.enabled === "function" ? layer.enabled() : (layer.enabled ?? true);
  return { ...layer, enabled };
}

const run = (factory: () => V2KeymapLayer, bind: string) => resolve(factory).commands?.find((command) => command.bind === bind)?.run();

describe("openCodeV2Setup", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps the dock's OpenCode 1 place: appended to the app slot", () => {
    const { ctx, claims } = context([session(ROOT)], []);
    createRoot(() => openCodeV2Setup(ctx));

    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ append: "app" });
  });

  it("registers the toggle globally, with OpenCode 1's id, key, slash name and palette entry", () => {
    const { ctx, layers } = context([session(ROOT)], []);
    createRoot(() => openCodeV2Setup(ctx));

    const toggle = resolve(layers[0]!);
    expect(toggle.mode).toBe("global");
    expect(toggle.commands).toEqual([
      expect.objectContaining({ id: TOGGLE.id, bind: "<leader>v", palette: true, slash: { name: "subagents" } }),
    ]);
  });

  it("takes up/down/return above the prompt's layers only while focused, and opens the selected subagent", () => {
    const { ctx, layers, navigate } = context([session(ROOT), session("a", ROOT), session("b", ROOT)], ["a", "b"]);
    createRoot(() => openCodeV2Setup(ctx));
    const [toggle, keys] = [layers[0]!, layers[1]!];

    expect(resolve(keys).priority).toBeGreaterThan(1);
    expect(resolve(keys).commands?.map((command) => command.bind)).toEqual(["up", "down", "return"]);
    expect(resolve(keys).enabled).toBe(false);

    resolve(toggle).commands?.[0]?.run();
    expect(resolve(keys).enabled).toBe(true);

    expect(run(keys, "down")).toBeUndefined();
    expect(run(keys, "return")).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith({ type: "session", sessionID: expect.stringMatching(/^[ab]$/) });
    // Opening a subagent leaves the dock, which gives the keys back.
    expect(resolve(keys).enabled).toBe(false);
  });

  it("leaves the dock and gives the keys back when the last subagent finishes", () => {
    const { ctx, layers } = context([session(ROOT), session("a", ROOT)], []);
    // Status as the host has it: reactive state.
    const [running, setRunning] = createSignal(true);
    ctx.data.session.status = (id) => (id === "a" && running() ? "running" : "idle");
    createRoot(() => openCodeV2Setup(ctx));
    resolve(layers[0]!).commands?.[0]?.run();
    expect(resolve(layers[1]!).enabled).toBe(true);

    setRunning(false);

    expect(resolve(layers[1]!).enabled).toBe(false);
  });

  it("releases its slot and stops its clock on cleanup", () => {
    const { ctx, released } = context([session(ROOT)], []);
    const cleanup = createRoot(() => openCodeV2Setup(ctx));

    cleanup?.();

    expect(released).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does nothing, rather than throw, under a host without the context it needs", () => {
    for (const ctx of [undefined, {}, { data: {} }]) {
      expect(openCodeV2Setup(ctx as never)).toBeUndefined();
    }
  });
});
