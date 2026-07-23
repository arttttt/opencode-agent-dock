// Adapter — SubagentStore backed by the opencode TUI state + client.
//
// Two regimes:
//   - Parent session (route has no parentID): list its RUNNING children — the
//     at-a-glance roster for the inline dock navigation.
//   - Subagent session (route has parentID): keep the panel up with the ONE
//     subagent currently in focus (so navigating into a subagent does not hide
//     the panel; native left/right between siblings updates it). `activeId`
//     exposes that focused id for highlighting.

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
  const data = (result as { data?: unknown } | null | undefined)?.data;
  return Array.isArray(data) ? (data as Session[]) : [];
}

function isArchived(session: Session): boolean {
  const archived = session.time.archived;
  return typeof archived === "number" && archived > 0;
}

export function createSubagentStore(api: TuiPluginApi, log: Logger): SubagentStore {
  const client = api.client as unknown as ChildrenClient;
  const listeners = new Set<() => void>();
  let cache: Subagent[] = [];
  let activeId: string | undefined;

  const emit = (): void => {
    for (const handler of listeners) handler();
  };

  const resolveCurrent = (): string | undefined => {
    const current = api.route.current as { name: string; params?: { sessionID?: string } };
    return current.name === "session" ? current.params?.sessionID : undefined;
  };

  const refresh = async (): Promise<void> => {
    const currentId = resolveCurrent();
    if (!currentId) {
      if (cache.length !== 0 || activeId !== undefined) {
        cache = [];
        activeId = undefined;
        emit();
      }
      return;
    }
    const session = api.state.session.get(currentId);
    if (!session) {
      return;
    }
    try {
      if (session.parentID) {
        // Inside a subagent: pin the panel to the one in focus.
        cache = [projectSubagent(session, api.state.session.status(currentId))];
        activeId = currentId;
      } else {
        // Parent session: list running children.
        const result = await client.session.children({ sessionID: currentId });
        const sessions = extractSessions(result);
        cache = sortSubagents(
          sessions
            .filter((item) => !isArchived(item))
            .map((item) => projectSubagent(item, api.state.session.status(item.id)))
            .filter((subagent) => subagent.status === "running"),
        ).slice(0, LIMITS.maxRows);
        activeId = undefined;
      }
      emit();
    } catch (error) {
      log.error(`dock refresh failed: ${error instanceof Error ? error.message : String(error)}`);
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
      return resolveCurrent();
    },
    get activeId(): string | undefined {
      return activeId;
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
