// Constants — plugin identity and tunable limits.

export const PLUGIN_ID = "arttttt.agent-dock";
export const SERVICE = "agent-dock";

export const LIMITS = {
  labelMax: 48,
  maxRows: 50,
  /** OpenCode 1: how often the roster is re-read, which also ticks elapsed time. */
  pollMs: 300,
  /** OpenCode 2: the roster is reactive, so this only ticks elapsed time. */
  tickMs: 1000,
} as const;

/** The toggle command, the same on both hosts so a user's remap carries over. */
export const TOGGLE = {
  id: "agent-dock.toggle",
  title: "Subagents",
  description: "Focus the subagent dock to navigate it",
  slash: "subagents",
  key: "<leader>v",
  bindingDescription: "Navigate subagents",
} as const;
