// SDK boundary — the only place that knows about @opencode-ai/sdk shapes.
// Projects SDK Session/SessionStatus into the neutral domain Subagent, so the
// rest of the codebase talks to domain types, not SDK types.

import type { Session, SessionStatus } from "@opencode-ai/sdk/v2";
import type { Subagent, SubagentStatus } from "./domain.js";

export function statusFromSessionStatus(status: SessionStatus | undefined): SubagentStatus {
  switch (status?.type) {
    case "busy":
      return "running";
    case "idle":
      return "idle";
    case "retry":
      return "running";
    default:
      return "done";
  }
}

export function projectSubagent(session: Session, status: SessionStatus | undefined): Subagent {
  const model = (session as Session & { model?: { modelID?: string } }).model?.modelID;
  return {
    id: session.id,
    title: session.title || session.agent || "subagent",
    status: statusFromSessionStatus(status),
    startedAt: readStartedAt(session),
    model,
  };
}

function readStartedAt(session: Session): number {
  const time = (session as Session & { time?: { created?: number } }).time;
  return time?.created ?? Date.now();
}
