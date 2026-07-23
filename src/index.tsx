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

  // One-shot diagnostic: confirms whether the host actually invokes the
  // app_bottom slot render. Combined with the per-refresh `children` log this
  // isolates "data ok but render not called" from "render called but invisible".
  let slotRenderLogged = false;

  const slot: TuiSlotPlugin = {
    slots: {
      app_bottom: (ctx) => {
        if (!slotRenderLogged) {
          slotRenderLogged = true;
          log.info(`app_bottom slot render invoked; rows=${store.snapshot().length}`);
        }
        const tone = ctx.theme.current;
        return (
          <Dock
            store={store}
            colors={{ text: tone.text, muted: tone.textMuted, accent: tone.primary }}
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
