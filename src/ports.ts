// Ports — abstractions the application layer depends on.
// (Dependency Inversion: high-level policy depends on these contracts, not on
// concrete IO or the opencode SDK. Adapters in src/adapters implement them.)

import type { Subagent } from "./domain.js";

/** Source of the current session's subagents. */
export interface SubagentStore {
  /** The session whose subagents we render (the active session route). */
  readonly parentSessionId: string | undefined;
  /** Snapshot of subagents, already sorted and capped for display. */
  snapshot(): Subagent[];
  /** Subscribe to store changes; returns an unsubscribe function. */
  onChange(handler: () => void): () => void;
}

/** Opens a session view — used to "look inside" a selected subagent. */
export interface SessionNavigator {
  open(sessionId: string): void;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
