// Constants — plugin identity, host wiring, and tunable limits.

export const PLUGIN_ID = "arttttt.agent-dock";
export const SERVICE = "agent-dock";

/**
 * Host slot the dock renders into.
 * `app_bottom` is rendered in normal layout flow BELOW the active route, so it
 * stays visible in the session view — the Claude-Code-style bottom placement.
 */
export const SLOT_NAME = "app_bottom";

/** Plugin-scoped keymap mode, pushed while the dock holds focus. */
export const DOCK_MODE = "agent-dock";

export const KEY = {
  focus: "alt+a",
  up: "k",
  down: "j",
  open: "return",
  exit: "escape",
} as const;

export const LIMITS = {
  labelMax: 48,
  maxRows: 8,
  pollMs: 1000,
} as const;
