// The OpenCode 2 store against a fake host whose data is a real Solid store,
// as @opencode/client's createData is: the roster must follow the data with no
// events and no poll, and elapsed time must tick on its own clock.

import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createV2SubagentStore, readRoster } from "../src/adapters/opencode-v2-subagent-store.js";
import { LIMITS } from "../src/constants.js";
import type { V2Route, V2Session } from "../src/v2/host.js";

const ROOT = "ses_root";

function session(id: string, parentID?: string, extra: Partial<V2Session> = {}): V2Session {
  const tokens = { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } };
  return { id, parentID, title: id, tokens, time: { created: 1 }, ...extra };
}

/** A host whose session data and route are Solid state, read the way createData reads its store. */
function host(initial: V2Session[], running: string[] = []) {
  const [store, setStore] = createStore({
    info: Object.fromEntries(initial.map((item) => [item.id, item])) as Record<string, V2Session>,
    active: Object.fromEntries(running.map((id) => [id, "running"])) as Record<string, "running">,
  });
  const [route, setRoute] = createSignal<V2Route>({ type: "session", sessionID: ROOT });
  const rootOf = (id: string): string => {
    const parent = store.info[id]?.parentID;
    return parent ? rootOf(parent) : id;
  };

  const data = {
    get: (id: string) => store.info[id],
    family: (id: string) => Object.keys(store.info).filter((other) => rootOf(other) === rootOf(id)),
    status: (id: string) => store.active[id] ?? "idle",
  };
  const router = { current: route, navigate: vi.fn() };
  return { data, router, setStore, setRoute };
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

describe("readRoster", () => {
  it("lists a parent session's running direct children, not grandchildren or idle ones", () => {
    const { data, router } = host(
      [session(ROOT), session("a", ROOT), session("b", ROOT), session("a1", "a"), session("old", ROOT, { time: { created: 1, archived: 5 } })],
      ["a", "a1", "old"],
    );

    expect(readRoster(data, router)).toEqual({ rows: [expect.objectContaining({ id: "a", status: "running" })], activeId: undefined });
  });

  it("pins the subagent in focus inside a subagent session, whatever its status", () => {
    const { data, router, setRoute } = host([session(ROOT), session("a", ROOT)]);
    setRoute({ type: "session", sessionID: "a" });

    expect(readRoster(data, router)).toEqual({ rows: [expect.objectContaining({ id: "a", status: "idle" })], activeId: "a" });
  });

  it("is empty off a session route, and for a session the data does not have yet", () => {
    const { data, router, setRoute } = host([session(ROOT)]);
    setRoute({ type: "home" });
    expect(readRoster(data, router).rows).toEqual([]);

    setRoute({ type: "session", sessionID: "ses_unknown" });
    expect(readRoster(data, router).rows).toEqual([]);
  });

  it("sums a child's tokens", () => {
    const tokens = { input: 10, output: 20, reasoning: 5, cache: { read: 3, write: 2 } };
    const { data, router } = host([session(ROOT), session("a", ROOT, { tokens })], ["a"]);

    expect(readRoster(data, router).rows[0]?.tokens).toBe(40);
  });
});

describe("createV2SubagentStore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("follows the data with no events and no poll: a child starts, finishes, is deleted", () => {
    const { data, router, setStore } = host([session(ROOT)]);
    const store = createV2SubagentStore(data, router);
    const changes = vi.fn();
    store.onChange(changes);
    expect(store.snapshot()).toEqual([]);

    setStore(produce((draft) => {
      draft.info.a = session("a", ROOT);
      draft.active.a = "running";
    }));
    expect(ids(store.snapshot())).toEqual(["a"]);
    expect(changes).toHaveBeenCalledTimes(1);

    setStore(produce((draft) => void delete draft.active.a));
    expect(store.snapshot()).toEqual([]);

    setStore(produce((draft) => {
      draft.active.a = "running";
    }));
    setStore(produce((draft) => {
      delete draft.info.a;
      delete draft.active.a;
    }));
    expect(store.snapshot()).toEqual([]);
    expect(changes).toHaveBeenCalledTimes(4);
    store.dispose();
  });

  it("follows the route: entering a subagent pins it and reports it active", () => {
    const { data, router, setRoute } = host([session(ROOT), session("a", ROOT)], ["a"]);
    const store = createV2SubagentStore(data, router);

    setRoute({ type: "session", sessionID: "a" });

    expect(store.activeId).toBe("a");
    expect(store.parentSessionId).toBe("a");
    expect(ids(store.snapshot())).toEqual(["a"]);
    store.dispose();
  });

  it("ticks every LIMITS.tickMs so elapsed time moves, and stops when disposed", () => {
    const { data, router } = host([session(ROOT)]);
    const store = createV2SubagentStore(data, router);
    const changes = vi.fn();
    store.onChange(changes);

    vi.advanceTimersByTime(LIMITS.tickMs * 3);
    expect(changes).toHaveBeenCalledTimes(3);

    store.dispose();
    vi.advanceTimersByTime(LIMITS.tickMs * 3);
    expect(changes).toHaveBeenCalledTimes(3);
  });
});
