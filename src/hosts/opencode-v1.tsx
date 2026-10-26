/** @jsxImportSource @opentui/solid */
// Host adapter — OpenCode 1 (1.18+): the `tui` function its TUI loader calls.
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

import type { TuiPlugin, TuiSlotPlugin } from "@opencode-ai/plugin/tui";
import { createSubagentStore } from "../adapters/opencode-subagent-store.js";
import { createLogger } from "../adapters/opencode-logger.js";
import { TOGGLE } from "../constants.js";
import { createDockController } from "../dock-controller.js";
import { Dock } from "../view/Dock.js";

type InterceptEvent = {
  name?: string;
  ctrl?: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
};

export const openCodeV1Tui: TuiPlugin = async (api) => {
  const log = createLogger(api.client);
  const store = createSubagentStore(api, log);
  log.info("agent-dock initialized");

  const dock = createDockController(store, (sessionID) => api.route.navigate("session", { sessionID }));

  const slot: TuiSlotPlugin = {
    slots: {
      app_bottom: (ctx) => {
        const tone = ctx.theme.current;
        return (
          <Dock
            store={store}
            selection={dock.selection}
            focused={dock.focused}
            activeId={dock.activeId}
            colors={{ text: tone.text, muted: tone.textMuted, accent: tone.primary }}
          />
        );
      },
    },
  };
  api.slots.register(slot);

  // Inline navigation: intercept arrows/enter while the dock is focused.
  api.keymap.intercept(
    "key",
    ({ event }: { event: InterceptEvent }) => {
      if (!dock.key(event.name)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    { priority: 1 },
  );

  api.keymap.registerLayer({
    mode: "base",
    commands: [
      {
        name: TOGGLE.id,
        title: TOGGLE.title,
        category: "Plugin",
        namespace: "palette",
        slashName: TOGGLE.slash,
        desc: TOGGLE.description,
        run: () => dock.toggle(),
      },
    ],
    bindings: [{ key: TOGGLE.key, cmd: TOGGLE.id, desc: TOGGLE.bindingDescription }],
  });
};
