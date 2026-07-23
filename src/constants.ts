// Constants — plugin identity, host wiring, and tunable limits.

export const PLUGIN_ID = "arttttt.agent-dock";
export const SERVICE = "agent-dock";

/**
 * Host slot the dock renders into.
 * `app_bottom` is rendered in normal layout flow BELOW the active route, so it
 * stays visible in the session view — the Claude-Code-style bottom placement.
 */
export const SLOT_NAME = "app_bottom";

export const LIMITS = {
  labelMax: 48,
  maxRows: 8,
  pollMs: 1000,
} as const;
