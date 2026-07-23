/** @jsxImportSource @opentui/solid */
// Composition root.
//
// Persistent bottom panel (app_bottom slot) of running subagents + inline arrow
// navigation. Why intercept instead of a dialog: the focused prompt textarea
// captures arrow keys, so a plugin can't navigate an inline panel via normal
// bindings. `api.keymap.intercept("key", ..., { priority })` runs BEFORE the
// textarea (same mechanism opencode's util/selection.ts uses for copy-on-select),
// so while the dock is focused we consume up/down/return + stopPropagation — the
// prompt never sees them. This is the "lock the input, navigate the panel"
// behavior. Escape is intentionally NOT intercepted (stays native = cancel).
//
// Toggle: `<leader>v` (ctrl+x then v) or `/subagents` — ctrl+x itself is left
// untouched (it is opencode's leader key).

import type { TuiPlugin, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui";
import { createSignal } from "solid-js";
import { PLUGIN_ID } from "./constants.js";
import { clampSelection } from "./domain.js";
import { createSubagentStore } from "./adapters/opencode-subagent-store.js";
import { createLogger } from "./adapters/opencode-logger.js";
import { Dock } from "./view/Dock.js";

type InterceptEvent = {
  name?: string;
  ctrl?: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
};

const tui: TuiPlugin = async (api) => {
  const log = createLogger(api.client);
  const store = createSubagentStore(api, log);
  log.info("agent-dock initialized");

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

  const slot: TuiSlotPlugin = {
    slots: {
      app_bottom: (ctx) => {
        const tone = ctx.theme.current;
        return (
          <Dock
            store={store}
            selection={selection}
            focused={focused}
            activeId={activeId}
            colors={{ text: tone.text, muted: tone.textMuted, accent: tone.primary }}
          />
        );
      },
    },
  };
  api.slots.register(slot);

  const enterDock = () => {
    if (store.snapshot().length === 0) return;
    setSelection(0);
    setFocused(true);
  };
  const exitDock = () => {
    setFocused(false);
  };

  // Inline navigation: intercept arrows/enter while the dock is focused.
  api.keymap.intercept(
    "key",
    ({ event }: { event: InterceptEvent }) => {
      if (!focused()) return;
      const rows = store.snapshot();
      if (rows.length === 0) {
        exitDock();
        return;
      }
      switch (event.name) {
        case "up":
          if (selection() <= 0) exitDock();
          else setSelection((current) => current - 1);
          event.preventDefault();
          event.stopPropagation();
          break;
        case "down":
          setSelection((current) => clampSelection(current + 1, rows.length));
          event.preventDefault();
          event.stopPropagation();
          break;
        case "return": {
          const target = rows[clampSelection(selection(), rows.length)];
          if (target) {
            exitDock();
            api.route.navigate("session", { sessionID: target.id });
          }
          event.preventDefault();
          event.stopPropagation();
          break;
        }
      }
    },
    { priority: 1 },
  );

  api.keymap.registerLayer({
    mode: "base",
    commands: [
      {
        name: "agent-dock.toggle",
        title: "Subagents",
        category: "Plugin",
        namespace: "palette",
        slashName: "subagents",
        desc: "Focus the subagent dock to navigate it",
        run: () => {
          if (focused()) exitDock();
          else enterDock();
        },
      },
    ],
    bindings: [{ key: "<leader>v", cmd: "agent-dock.toggle", desc: "Navigate subagents" }],
  });
};

const plugin: TuiPluginModule & { id: string } = {
  id: PLUGIN_ID,
  tui,
};

export default plugin;
