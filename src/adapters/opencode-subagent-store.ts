// Adapter — SubagentStore backed by the opencode TUI state + client.
//
// Subagents are child sessions of the active parent. Discovery uses
// `client.session.children({ sessionID })` (the SDK's "forked-from-parent"
// endpoint), refreshed on an interval and on session lifecycle events. Live
// status for each child is read from the in-process `api.state.session.status`.

import type { Session } from "@opencode-ai/sdk/v2";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { Subagent, SubagentStatus } from "../domain.js";
import { sortSubagents } from "../domain.js";
import { projectSubagent } from "../sdk.js";
import type { SubagentStore } from "../ports.js";
import { LIMITS } from "../constants.js";

type ChildrenClient = {
  session: {
    children(parameters: {
      sessionID: string;
      directory?: string;
      workspace?: string;
    }): Promise<{ data?: Session[] | undefined }>;
  };
};

export function createSubagentStore(api: TuiPluginApi): SubagentStore {
  const client = api.client as unknown as ChildrenClient;
  const listeners = new Set<() => void>();
  let cache: Subagent[] = [];
  let parentAtLastFetch: string | undefined;

  const emit = (): void => {
    for (const handler of listeners) handler();
  };

  const resolveParent = (): string | undefined => {
    const current = api.route.current as { name: string; params?: { sessionID?: string } };
    return current.name === "session" ? current.params?.sessionID : undefined;
  };

  const statusOf = (id: string): SubagentStatus => {
    const status = api.state.session.status(id);
    return projectSubagent({} as Session, status).status;
  };

  const refresh = async (): Promise<void> => {
    const parent = resolveParent();
    if (!parent) {
      if (cache.length !== 0) {
        cache = [];
        emit();
      }
      return;
    }
    if (parent === parentAtLastFetch && cache.length === 0) {
      // No children last time and same parent — skip the round-trip until the
      // event stream signals a creation. Cheap perf guard, not correctness.
    }
    try {
      const result = await client.session.children({ sessionID: parent });
      const sessions = result.data ?? [];
      parentAtLastFetch = parent;
      cache = sortSubagents(
        sessions.map((session) => ({
          ...projectSubagent(session, api.state.session.status(session.id)),
          status: statusOf(session.id),
        })),
      ).slice(0, LIMITS.maxRows);
      emit();
    } catch {
      // Swallow transient fetch errors; next tick/event retries.
    }
  };

  void refresh();
  const interval = setInterval(() => void refresh(), LIMITS.pollMs);

  // Refresh eagerly when a session is created/idle — a new subagent or a
  // finished one. The TUI event bus is the reactive trigger.
  const subscribe = api.event.on as unknown as (
    type: string,
    handler: () => void,
  ) => () => void;
  const unsubs = [
    subscribe("session.created", () => void refresh()),
    subscribe("session.idle", () => void refresh()),
    subscribe("session.updated", () => void refresh()),
  ];

  api.lifecycle.onDispose(() => {
    clearInterval(interval);
    for (const unsub of unsubs) unsub();
  });

  return {
    get parentSessionId(): string | undefined {
      return resolveParent();
    },
    snapshot(): Subagent[] {
      return cache;
    },
    onChange(handler: () => void): () => void {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
}
