// Domain — pure policy. No IO, no SDK, no Solid. Fully unit-testable.

export type SubagentStatus = "running" | "idle" | "done" | "error";

/** Neutral projection of a child session. SDK-shape mapping lives in sdk.ts. */
export type Subagent = {
  id: string;
  title: string;
  status: SubagentStatus;
  startedAt: number;
  model?: string;
  tokens?: number;
};

/** View-model row derived from a Subagent at a point in time. */
export type DockRow = {
  subagent: Subagent;
  glyph: string;
  label: string;
  meta: string;
};

const STATUS_GLYPH: Record<SubagentStatus, string> = {
  running: "●",
  idle: "○",
  done: "✓",
  error: "✗",
};

const STATUS_RANK: Record<SubagentStatus, number> = {
  running: 0,
  idle: 1,
  done: 2,
  error: 3,
};

export function sortSubagents(list: readonly Subagent[]): Subagent[] {
  return [...list].sort((a, b) => {
    const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    return r !== 0 ? r : b.startedAt - a.startedAt;
  });
}

export function clampSelection(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

export function formatElapsed(startedAt: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${String(remSeconds).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function formatTokens(tokens: number | undefined): string {
  if (tokens === undefined || tokens <= 0) return "";
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
}

export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

export function isTerminal(status: SubagentStatus): boolean {
  return status === "done" || status === "error";
}

export function toRow(subagent: Subagent, now: number, labelMax: number): DockRow {
  const meta: string[] = [];
  if (!isTerminal(subagent.status)) meta.push(formatElapsed(subagent.startedAt, now));
  if (subagent.tokens !== undefined) meta.push(formatTokens(subagent.tokens));
  return {
    subagent,
    glyph: STATUS_GLYPH[subagent.status],
    label: truncate(subagent.title || subagent.id, labelMax),
    meta: meta.join(" \u00b7 "),
  };
}
