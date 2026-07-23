// Ports — abstractions the application layer depends on.
// (Dependency Inversion: high-level policy depends on these contracts, not on
// concrete IO or the opencode SDK. Adapters in src/adapters implement them.)

import type { Subagent } from "./domain.js";

/** Source of the current session's subagents. */
export interface SubagentStore {
  /** The session whose subagents we render (the active session route). */
  readonly parentSessionId: string | undefined;
  /** When the active route is a subagent session — its id, so the panel can
   * highlight the one currently in focus. Undefined in the parent session. */
  readonly activeId: string | undefined;
  /** Snapshot of subagents, already sorted and capped for display. */
  snapshot(): Subagent[];
  /** Subscribe to store changes; returns an unsubscribe function. */
  onChange(handler: () => void): () => void;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
