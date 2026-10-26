// Application — the dock's interaction state, shared by both OpenCode hosts.
//
// Which row is selected, whether the dock holds the keyboard, which subagent is
// active: Solid signals the view reads, kept consistent with the store. The
// hosts differ only in how keys reach `key` and how a session is opened.

import { createSignal } from "solid-js";
import { clampSelection } from "./domain.js";
import type { SubagentStore } from "./ports.js";

/** The keys the dock consumes while it is focused. Everything else stays native. */
export type DockKey = "up" | "down" | "return";

export type DockController = {
  readonly selection: () => number;
  readonly focused: () => boolean;
  readonly activeId: () => string | undefined;
  /** Focus the dock, or leave it if it is focused. */
  toggle(): void;
  /** Handle a key while focused; true when the dock consumed it. */
  key(name: string | undefined): boolean;
};

export function createDockController(store: SubagentStore, open: (sessionID: string) => void): DockController {
  const [selection, setSelection] = createSignal(0);
  const [focused, setFocused] = createSignal(false);
  const [activeId, setActiveId] = createSignal<string | undefined>(undefined);

  // Mirror the store's active id + keep selection in range as rows change; leave
  // the dock if the roster empties.
  store.onChange(() => {
    setActiveId(store.activeId);
    const rows = store.snapshot();
    if (rows.length === 0) {
      if (focused()) setFocused(false);
      return;
    }
    const clamped = clampSelection(selection(), rows.length);
    if (clamped !== selection()) setSelection(clamped);
  });

  const enter = () => {
    if (store.snapshot().length === 0) return;
    setSelection(0);
    setFocused(true);
  };
  const exit = () => setFocused(false);

  return {
    selection,
    focused,
    activeId,
    toggle() {
      if (focused()) exit();
      else enter();
    },
    key(name) {
      if (!focused()) return false;
      const rows = store.snapshot();
      if (rows.length === 0) {
        exit();
        return false;
      }
      switch (name) {
        case "up":
          if (selection() <= 0) exit();
          else setSelection((current) => current - 1);
          return true;
        case "down":
          setSelection((current) => clampSelection(current + 1, rows.length));
          return true;
        case "return": {
          const target = rows[clampSelection(selection(), rows.length)];
          if (target) {
            exit();
            open(target.id);
          }
          return true;
        }
        default:
          return false;
      }
    },
  };
}
