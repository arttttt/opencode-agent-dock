/** @jsxImportSource @opentui/solid */
// Composition root — the only place that knows about concrete adapters and the
// opencode TUI API. Wires dependencies and contributes the `app_bottom` slot.

import type { TuiPlugin, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui";
import { PLUGIN_ID } from "./constants.js";
import { createSubagentStore } from "./adapters/opencode-subagent-store.js";
import { createLogger } from "./adapters/opencode-logger.js";
import { Dock } from "./view/Dock.js";

const tui: TuiPlugin = async (api) => {
  const log = createLogger(api.client);
  const store = createSubagentStore(api, log);
  log.info("agent-dock initialized");

  const slot: TuiSlotPlugin = {
    slots: {
      // `app_bottom` = persistent strip below the active route (visible in the
      // session view). Render reads the store live; Dock hides itself when there
      // are no subagents.
      app_bottom: (ctx) => {
        const tone = ctx.theme.current;
            return (
              <Dock
                store={store}
                colors={{
                  text: tone.text,
                  muted: tone.textMuted,
                  accent: tone.primary,
                  border: tone.border,
                  panel: tone.backgroundPanel,
                }}
              />
            );
      },
    },
  };
  api.slots.register(slot);
};

const plugin: TuiPluginModule & { id: string } = {
  id: PLUGIN_ID,
  tui,
};

export default plugin;
