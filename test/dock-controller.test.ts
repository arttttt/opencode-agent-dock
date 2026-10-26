// The interaction state both hosts share: focus, selection, which keys it
// consumes, and when it gives them back.

import { describe, expect, it, vi } from "vitest";

import type { Subagent } from "../src/domain.js";
import { createDockController } from "../src/dock-controller.js";
import type { SubagentStore } from "../src/ports.js";

function store(initial: string[]) {
  let rows: Subagent[] = initial.map((id) => ({ id, title: id, status: "running", startedAt: 1 }));
  const listeners = new Set<() => void>();
  const fake: SubagentStore = {
    parentSessionId: "ses_root",
    activeId: undefined,
    snapshot: () => rows,
    onChange: (handler) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
  };
  const set = (ids: string[]) => {
    rows = ids.map((id) => ({ id, title: id, status: "running", startedAt: 1 }));
    for (const handler of listeners) handler();
  };
  return { fake, set };
}

describe("createDockController", () => {
  it("consumes nothing while not focused", () => {
    const dock = createDockController(store(["a"]).fake, vi.fn());

    expect(dock.key("down")).toBe(false);
  });

  it("does not focus an empty dock", () => {
    const dock = createDockController(store([]).fake, vi.fn());
    dock.toggle();

    expect(dock.focused()).toBe(false);
  });

  it("moves through the rows, leaves from the top, and opens the selected one", () => {
    const open = vi.fn();
    const dock = createDockController(store(["a", "b"]).fake, open);
    dock.toggle();

    expect(dock.key("down")).toBe(true);
    expect(dock.key("down")).toBe(true);
    expect(dock.selection()).toBe(1);
    expect(dock.key("return")).toBe(true);
    expect(open).toHaveBeenCalledWith("b");
    expect(dock.focused()).toBe(false);

    dock.toggle();
    expect(dock.key("up")).toBe(true);
    expect(dock.focused()).toBe(false);
  });

  it("leaves other keys native", () => {
    const dock = createDockController(store(["a"]).fake, vi.fn());
    dock.toggle();

    expect(dock.key("escape")).toBe(false);
    expect(dock.key(undefined)).toBe(false);
    expect(dock.focused()).toBe(true);
  });

  it("leaves and gives the key back when the roster empties", () => {
    const { fake, set } = store(["a"]);
    const dock = createDockController(fake, vi.fn());
    dock.toggle();

    set([]);

    expect(dock.focused()).toBe(false);
    expect(dock.key("down")).toBe(false);
  });

  it("keeps the selection in range as rows go away", () => {
    const { fake, set } = store(["a", "b", "c"]);
    const dock = createDockController(fake, vi.fn());
    dock.toggle();
    dock.key("down");
    dock.key("down");

    set(["a"]);

    expect(dock.selection()).toBe(0);
  });
});
