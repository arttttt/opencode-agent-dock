// Constants — plugin identity and tunable limits.

export const PLUGIN_ID = "arttttt.agent-dock";
export const SERVICE = "agent-dock";

export const LIMITS = {
  labelMax: 48,
  maxRows: 50,
  pollMs: 300,
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
