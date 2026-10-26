// The subagent store against a stub TUI API: which events it listens to, and
// that a deleted subagent leaves the dock on the event, not only on the poll.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_EVENTS, createSubagentStore } from "../src/adapters/opencode-subagent-store.js";

const PARENT = "ses_parent";

function child(id: string) {
  return { id, parentID: PARENT, title: id, time: { created: 1, updated: 1 } };
}

function harness(children: ReturnType<typeof child>[]) {
  const handlers = new Map<string, () => void>();
  const disposers: (() => void)[] = [];
  const api = {
    client: { session: { children: async () => ({ data: [...children] }) } },
    route: { current: { name: "session", params: { sessionID: PARENT } } },
    state: {
      session: {
        get: (id: string) => (id === PARENT ? { id: PARENT, time: { created: 0 } } : undefined),
        status: () => ({ type: "busy" }),
      },
    },
    event: {
      on: (type: string, handler: () => void) => {
        handlers.set(type, handler);
        return () => handlers.delete(type);
      },
    },
    lifecycle: { onDispose: (fn: () => void) => disposers.push(fn) },
  };
  const log = { info: () => {}, warn: () => {}, error: () => {} };
  const store = createSubagentStore(api as never, log);
  return { store, handlers, dispose: () => disposers.forEach((fn) => fn()) };
}

/** Let pending refreshes finish without moving the clock, so the poll never fires. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe("createSubagentStore", () => {
  // Fake timers: only the event can refresh the roster within a test.
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("listens to the session events OpenCode publishes, session.deleted among them", () => {
    const { handlers, dispose } = harness([]);

    expect([...handlers.keys()]).toEqual([...SESSION_EVENTS]);
    expect(handlers.has("session.deleted")).toBe(true);
    expect(handlers.has("session.removed")).toBe(false);
    dispose();
  });

  it("drops a deleted subagent on session.deleted, before the next poll", async () => {
    const children = [child("ses_a"), child("ses_b")];
    const { store, handlers, dispose } = harness(children);
    await settle();
    expect(store.snapshot().map((row) => row.id)).toHaveLength(2);

    children.splice(0, 1);
    handlers.get("session.deleted")!();
    await settle();

    expect(store.snapshot().map((row) => row.id)).toEqual(["ses_b"]);
    dispose();
  });

  it("stops listening on dispose", () => {
    const { handlers, dispose } = harness([]);
    dispose();

    expect(handlers.size).toBe(0);
  });
});
