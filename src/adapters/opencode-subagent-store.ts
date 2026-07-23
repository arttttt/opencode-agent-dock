// Adapter — SubagentStore backed by the opencode TUI state + client.
//
// Subagents are child sessions of the active parent. Discovery uses
// `client.session.children({ sessionID })` (the SDK's "forked-from-parent"
// endpoint), refreshed on an interval and on session lifecycle events. Live
// status for each child is read from the in-process `api.state.session.status`.
//
// The children response shape is not yet confirmed against the live server, so
// parsing is tolerant of { data: [...] } / { data: { sessions: [...] } } / [...]
// and every refresh logs what came back — see grep `agent-dock` in the log.

import type { Session } from "@opencode-ai/sdk/v2";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { Subagent, SubagentStatus } from "../domain.js";
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

const describeFirst = (sessions: Session[]): string => {
  const first = sessions[0];
  if (!first) return "none";
  return `id=${first.id.slice(0, 8)} title="${first.title}" agent=${first.agent ?? "?"} parentID=${(first as Session & { parentID?: string }).parentID ?? "?"}`;
};

export function createSubagentStore(api: TuiPluginApi, log: Logger): SubagentStore {
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
    try {
      const result = await client.session.children({ sessionID: parent });
      const sessions = extractSessions(result);
      const resultKeys = result && typeof result === "object" ? Object.keys(result).join("|") : typeof result;
      log.info(
        `children parent=${parent.slice(0, 8)} resultKeys=${resultKeys} parsed=${sessions.length} first=${describeFirst(sessions)}`,
      );
      cache = sortSubagents(
        sessions.map((session) => {
          const subagent = projectSubagent(session, api.state.session.status(session.id));
          return { ...subagent, status: statusOf(session.id) };
        }),
      ).slice(0, LIMITS.maxRows);
      parentAtLastFetch = parent;
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
