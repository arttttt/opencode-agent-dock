/** @jsxImportSource @opentui/solid */
// Host adapter — OpenCode 2: the `setup` its TUI calls with a plugin context.
//
// The dock keeps its OpenCode 1 place: the `app` slot, appended after the route
// content on every route — where app_bottom was. OpenCode 2 has no key
// intercept; its keymap orders layers by priority alone, so a layer above the
// prompt's own (priority 1, its history and cursor keys), enabled only while
// the dock is focused, takes up/down/return first. Escape stays native.

import { createV2SubagentStore } from "../adapters/opencode-v2-subagent-store.js";
import { TOGGLE } from "../constants.js";
import { createDockController, type DockKey } from "../dock-controller.js";
import type { V2Cleanup, V2Context } from "../v2/host.js";
import { Dock } from "../view/Dock.js";

const DOCK_KEYS: readonly DockKey[] = ["up", "down", "return"];

/**
 * Above the prompt's layers, which use priority 1. The key layer keeps the
 * default "base" mode, the prompt's: a UI that pushes another mode (a dialog,
 * autocomplete) suspends it, and the dock's keys with it.
 */
const DOCK_PRIORITY = 2;

function isV2Context(context: unknown): context is V2Context {
  const candidate = context as Partial<V2Context> | null | undefined;
  return (
    typeof candidate?.data?.session?.get === "function" &&
    typeof candidate?.ui?.slot === "function" &&
    typeof candidate?.ui?.router?.current === "function" &&
    typeof candidate?.keymap?.layer === "function"
  );
}

export function openCodeV2Setup(context: V2Context): V2Cleanup | void {
  // A host that calls setup without this context gets a no-op, not a crash.
  if (!isV2Context(context)) return;
  const { data, ui, keymap, theme } = context;

  const store = createV2SubagentStore(data.session, ui.router);
  const dock = createDockController(store, (sessionID) => ui.router.navigate({ type: "session", sessionID }));

  const release = ui.slot({
    append: "app",
    render: () => (
      <Dock
        store={store}
        selection={dock.selection}
        focused={dock.focused}
        activeId={dock.activeId}
        colors={{ text: theme.text.base, muted: theme.text.muted, accent: theme.text.action.primary.base }}
      />
    ),
  });

  keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: TOGGLE.id,
        title: TOGGLE.title,
        description: TOGGLE.description,
        group: "Plugin",
        palette: true,
        slash: { name: TOGGLE.slash },
        bind: TOGGLE.key,
        run: () => dock.toggle(),
      },
    ],
  }));

  keymap.layer(() => ({
    enabled: () => dock.focused(),
    priority: DOCK_PRIORITY,
    commands: DOCK_KEYS.map((key) => ({
      bind: key,
      title: `Subagent dock: ${key}`,
      group: "Plugin",
      // Not consumed (the roster emptied) → let the prompt have the key.
      run: () => (dock.key(key) ? undefined : false),
    })),
  }));

  return () => {
    release();
    store.dispose();
  };
}
