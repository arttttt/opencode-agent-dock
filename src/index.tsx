/** @jsxImportSource @opentui/solid */
// Composition root — the only place that knows about concrete adapters and the
// opencode TUI API. Wires dependencies, owns selection state, registers the
// slot render and the keymap layers. (Everything else depends on ports.)

import { createSignal } from "solid-js";
import type { TuiPlugin, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui";
import { DOCK_MODE, KEY, PLUGIN_ID, SLOT_NAME } from "./constants.js";
import { clampSelection, moveSelection } from "./domain.js";
import { createSubagentStore } from "./adapters/opencode-subagent-store.js";
import { createNavigator } from "./adapters/opencode-navigator.js";
import { createLogger } from "./adapters/opencode-logger.js";
import { Dock } from "./view/Dock.js";

const tui: TuiPlugin = async (api) => {
  const log = createLogger(api.client);
  const store = createSubagentStore(api);
  const navigator = createNavigator(api);
  const [selection, setSelection] = createSignal(0);

  log.info("agent-dock initialized");

  const length = (): number => store.snapshot().length;

  let popDock: (() => void) | undefined;

  api.keymap.registerLayer({
    mode: "base",
    commands: [
      {
        name: "agent-dock.focus",
        title: "Agent Dock",
        category: "Plugin",
        namespace: "palette",
        slashName: "dock",
        desc: "Focus the subagent dock",
        run() {
          if (!popDock) popDock = api.mode.push(DOCK_MODE);
        },
      },
    ],
    bindings: [{ key: KEY.focus, cmd: "agent-dock.focus", desc: "Focus subagent dock" }],
  });

  api.keymap.registerLayer({
    mode: DOCK_MODE,
    commands: [
      {
        name: "agent-dock.up",
        title: "Dock: up",
        category: "Plugin",
        run() {
          setSelection((current) => moveSelection(current, length(), -1));
        },
      },
      {
        name: "agent-dock.down",
        title: "Dock: down",
        category: "Plugin",
        run() {
          setSelection((current) => moveSelection(current, length(), 1));
        },
      },
      {
        name: "agent-dock.open",
        title: "Dock: open subagent",
        category: "Plugin",
        run() {
          const rows = store.snapshot();
          const target = rows[clampSelection(selection(), rows.length)];
          if (target) navigator.open(target.id);
        },
      },
      {
        name: "agent-dock.exit",
        title: "Dock: close",
        category: "Plugin",
        run() {
          popDock?.();
          popDock = undefined;
        },
      },
    ],
    bindings: [
      { key: KEY.up, cmd: "agent-dock.up", desc: "Previous subagent" },
      { key: KEY.down, cmd: "agent-dock.down", desc: "Next subagent" },
      { key: KEY.open, cmd: "agent-dock.open", desc: "Open subagent session" },
      { key: KEY.exit, cmd: "agent-dock.exit", desc: "Leave dock" },
    ],
  });

  api.lifecycle.onDispose(() => {
    popDock?.();
    popDock = undefined;
  });

  const slot = {
    name: SLOT_NAME,
    component: () => <Dock store={store} selection={selection} />,
  } as unknown as TuiSlotPlugin;
  api.slots.register(slot);
};

const plugin: TuiPluginModule & { id: string } = {
  id: PLUGIN_ID,
  tui,
};

export default plugin;
