// SDK boundary — the only place that knows about @opencode-ai/sdk shapes.
// Projects SDK Session/SessionStatus into the neutral domain Subagent.

import type { Session, SessionStatus } from "@opencode-ai/sdk/v2";
import type { Subagent, SubagentStatus } from "./domain.js";

export function statusFromSessionStatus(status: SessionStatus | undefined): SubagentStatus {
  switch (status?.type) {
    case "busy":
    case "retry":
      return "running";
    case "idle":
      return "idle";
    default:
      return "done";
  }
}

function totalTokens(tokens: Session["tokens"] | undefined): number | undefined {
  if (!tokens) return undefined;
  const total = tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write;
  return total > 0 ? total : undefined;
}

export function projectSubagent(session: Session, status: SessionStatus | undefined): Subagent {
  return {
    id: session.id,
    title: session.title || session.agent || "subagent",
    status: statusFromSessionStatus(status),
    startedAt: session.time.created,
    model: session.model?.id,
    tokens: totalTokens(session.tokens),
  };
}
