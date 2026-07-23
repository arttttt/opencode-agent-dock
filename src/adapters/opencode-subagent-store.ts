// Adapter — SubagentStore backed by the opencode TUI state + client.
//
// Subagents are child sessions of the active parent. Discovery uses
// `client.session.children({ sessionID })`, refreshed on an interval and on
// session lifecycle events. Only sessions that are ACTIVELY RUNNING (busy) are
// shown — finished/idle/cancelled/archived ones are dropped so the panel
// reflects "currently working subagents" and clears itself on cancel.

import type { Session } from "@opencode-ai/sdk/v2";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { Subagent } from "../domain.js";
import { sortSubagents } from "../domain.js";
import { projectSubagent } from "../sdk.js";
import type { Logger, SubagentStore } from "../ports.js";
import { LIMITS } from "../constants.js";

type ChildrenClient = {
  session: {
    children(parameters: {
      sessionID: string;
      directory?: string;
      workspace?: string;
    }): Promise<unknown>;
  };
};

function extractSessions(result: unknown): Session[] {
  if (Array.isArray(result)) return result as Session[];
  const data = (result as { data?: unknown } | null | undefined)?.data;
  if (Array.isArray(data)) return data as Session[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj["sessions"])) return obj["sessions"] as Session[];
    if (Array.isArray(obj["children"])) return obj["children"] as Session[];
  }
  return [];
}

function isArchived(session: Session): boolean {
  const archived = (session as Session & { time?: { archived?: number } }).time?.archived;
  return typeof archived === "number" && archived > 0;
}

export function createSubagentStore(api: TuiPluginApi, log: Logger): SubagentStore {
  const client = api.client as unknown as ChildrenClient;
  const listeners = new Set<() => void>();
  let cache: Subagent[] = [];
  let lastSig = "";

  const emit = (): void => {
    for (const handler of listeners) handler();
  };

  const resolveParent = (): string | undefined => {
    const current = api.route.current as { name: string; params?: { sessionID?: string } };
    return current.name === "session" ? current.params?.sessionID : undefined;
  };

  const refresh = async (): Promise<void> => {
    const parent = resolveParent();
    if (!parent) {
      if (cache.length !== 0) {
        cache = [];
        lastSig = "";
        emit();
      }
      return;
    }
    try {
      const result = await client.session.children({ sessionID: parent });
      const sessions = extractSessions(result);
      const visible = sortSubagents(
        sessions
          .filter((session) => !isArchived(session))
          .map((session) => projectSubagent(session, api.state.session.status(session.id)))
          .filter((subagent) => subagent.status === "running"),
      ).slice(0, LIMITS.maxRows);

      const sig = visible.map((s) => `${s.id.slice(-4)}:${s.status}`).join(",") || "-";
      if (sig !== lastSig) {
        lastSig = sig;
        log.info(`children parent=${parent.slice(0, 8)} parsed=${sessions.length} running=${visible.length} [${sig}]`);
      }

      cache = visible;
      emit();
    } catch (error) {
      log.error(`children fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  void refresh();
  const interval = setInterval(() => void refresh(), LIMITS.pollMs);

  const subscribe = api.event.on as unknown as (
    type: string,
    handler: () => void,
  ) => () => void;
  const unsubs = [
    subscribe("session.created", () => void refresh()),
    subscribe("session.idle", () => void refresh()),
    subscribe("session.updated", () => void refresh()),
    subscribe("session.removed", () => void refresh()),
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
