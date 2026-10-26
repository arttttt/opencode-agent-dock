// Adapter — SubagentStore over OpenCode 2's live data.
//
// Same two regimes as the OpenCode 1 store (parent session: its RUNNING direct
// children; subagent session: the one in focus, pinned). No events, no poll:
// ctx.data is the client's Solid store, kept current by the server's events,
// and the plugin shares the host's solid-js, so a memo over its reads re-runs
// whenever a session is created, changes status, is renamed, spends tokens or
// is deleted. Only elapsed time needs a clock: a tick every LIMITS.tickMs.

import { createEffect, createMemo, createRoot, on } from "solid-js";
import { LIMITS } from "../constants.js";
import type { Subagent } from "../domain.js";
import { sortSubagents } from "../domain.js";
import type { SubagentStore } from "../ports.js";
import { projectV2Subagent } from "../sdk.js";
import type { V2Router, V2SessionData } from "../v2/host.js";

type Roster = { rows: Subagent[]; activeId: string | undefined };

const EMPTY: Roster = { rows: [], activeId: undefined };

/** The roster for the session the router shows: pure reads, so a memo tracks them. */
export function readRoster(data: V2SessionData, router: V2Router): Roster {
  const route = router.current();
  if (route.type !== "session") return EMPTY;
  const session = data.get(route.sessionID);
  if (!session) return EMPTY;

  // Inside a subagent: pin the panel to the one in focus.
  if (session.parentID) {
    return { rows: [projectV2Subagent(session, data.status(session.id))], activeId: session.id };
  }

  // Parent session: its running direct children. family() is the whole tree
  // under the root, so keep only the sessions whose parent is this one.
  const children = data
    .family(session.id)
    .map((id) => data.get(id))
    .filter((child): child is NonNullable<typeof child> => child?.parentID === session.id && !child.time.archived)
    .map((child) => projectV2Subagent(child, data.status(child.id)))
    .filter((subagent) => subagent.status === "running");
  return { rows: sortSubagents(children).slice(0, LIMITS.maxRows), activeId: undefined };
}

export function createV2SubagentStore(data: V2SessionData, router: V2Router): SubagentStore & { dispose(): void } {
  const listeners = new Set<() => void>();
  const emit = (): void => {
    for (const handler of listeners) handler();
  };

  return createRoot((disposeRoot) => {
    const roster = createMemo(() => readRoster(data, router));
    createEffect(on(roster, emit, { defer: true }));
    const tick = setInterval(emit, LIMITS.tickMs);

    return {
      get parentSessionId(): string | undefined {
        const route = router.current();
        return route.type === "session" ? route.sessionID : undefined;
      },
      get activeId(): string | undefined {
        return roster().activeId;
      },
      snapshot: () => roster().rows,
      onChange(handler) {
        listeners.add(handler);
        return () => listeners.delete(handler);
      },
      dispose() {
        clearInterval(tick);
        listeners.clear();
        disposeRoot();
      },
    };
  });
}
