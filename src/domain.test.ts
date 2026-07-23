import { describe, it, expect } from "vitest";
import {
  sortSubagents,
  clampSelection,
  formatElapsed,
  formatTokens,
  truncate,
  isTerminal,
  toRow,
  type Subagent,
} from "./domain.js";
import { statusFromSessionStatus } from "./sdk.js";

const sub = (overrides: Partial<Subagent> = {}): Subagent => ({
  id: "ses_1",
  title: "Analyze architecture",
  status: "running",
  startedAt: 0,
  ...overrides,
});

describe("sortSubagents", () => {
  it("orders running before idle before terminal states", () => {
    const list = [
      sub({ id: "done", status: "done", startedAt: 1 }),
      sub({ id: "idle", status: "idle", startedAt: 2 }),
      sub({ id: "run", status: "running", startedAt: 3 }),
    ];
    expect(sortSubagents(list).map((s) => s.id)).toEqual(["run", "idle", "done"]);
  });

  it("falls back to newest-first within the same status", () => {
    const list = [
      sub({ id: "old", status: "running", startedAt: 10 }),
      sub({ id: "new", status: "running", startedAt: 90 }),
    ];
    expect(sortSubagents(list).map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("does not mutate the input", () => {
    const list = [sub({ id: "a" }), sub({ id: "b" })];
    const snapshot = list.map((s) => s.id);
    sortSubagents(list);
    expect(list.map((s) => s.id)).toEqual(snapshot);
  });
});

describe("clampSelection", () => {
  it("returns 0 for an empty list", () => {
    expect(clampSelection(5, 0)).toBe(0);
  });
  it("clamps below 0 to 0", () => {
    expect(clampSelection(-3, 4)).toBe(0);
  });
  it("clamps overflow to the last index", () => {
    expect(clampSelection(99, 4)).toBe(3);
  });
  it("passes through in-range values", () => {
    expect(clampSelection(2, 4)).toBe(2);
  });
});

describe("formatElapsed", () => {
  it("formats seconds under a minute", () => {
    expect(formatElapsed(0, 59_000)).toBe("59s");
  });
  it("formats minutes with zero-padded seconds", () => {
    expect(formatElapsed(0, 125_000)).toBe("2m 05s");
  });
  it("formats hours with zero-padded minutes", () => {
    expect(formatElapsed(0, 3_725_000)).toBe("1h 02m");
  });
  it("never goes negative", () => {
    expect(formatElapsed(10_000, 0)).toBe("0s");
  });
});

describe("formatTokens", () => {
  it("returns empty for undefined / non-positive", () => {
    expect(formatTokens(undefined)).toBe("");
    expect(formatTokens(0)).toBe("");
  });
  it("renders raw numbers under 1000", () => {
    expect(formatTokens(500)).toBe("500");
    expect(formatTokens(999)).toBe("999");
  });
  it("renders thousands with a k suffix", () => {
    expect(formatTokens(1500)).toBe("1.5k");
    expect(formatTokens(85_400)).toBe("85.4k");
  });
});

describe("truncate", () => {
  it("trims and returns short text as-is", () => {
    expect(truncate("  hi  ", 10)).toBe("hi");
  });
  it("truncates with an ellipsis when too long", () => {
    expect(truncate("hello world", 5)).toBe("hell…");
  });
  it("handles exact length without truncation", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });
});

describe("isTerminal", () => {
  it("treats done and error as terminal", () => {
    expect(isTerminal("done")).toBe(true);
    expect(isTerminal("error")).toBe(true);
  });
  it("treats running and idle as non-terminal", () => {
    expect(isTerminal("running")).toBe(false);
    expect(isTerminal("idle")).toBe(false);
  });
});

describe("toRow", () => {
  it("maps status to a glyph", () => {
    expect(toRow(sub({ status: "running" }), 0, 48).glyph).toBe("●");
    expect(toRow(sub({ status: "done" }), 0, 48).glyph).toBe("✓");
  });
  it("shows elapsed + tokens in meta for a running subagent", () => {
    const row = toRow(sub({ status: "running", startedAt: 0, tokens: 1500 }), 30_000, 48);
    expect(row.meta).toBe("30s · 1.5k");
  });
  it("drops elapsed for terminal states", () => {
    const row = toRow(sub({ status: "done", tokens: 500 }), 30_000, 48);
    expect(row.meta).toBe("500");
  });
  it("falls back to the id when the title is empty", () => {
    expect(toRow(sub({ title: "", id: "ses_x" }), 0, 48).label).toBe("ses_x");
  });
});

describe("statusFromSessionStatus", () => {
  it("maps busy and retry to running", () => {
    expect(statusFromSessionStatus({ type: "busy" })).toBe("running");
    expect(statusFromSessionStatus({ type: "retry", attempt: 1, message: "x", next: 1 })).toBe("running");
  });
  it("maps idle to idle", () => {
    expect(statusFromSessionStatus({ type: "idle" })).toBe("idle");
  });
  it("maps undefined to done", () => {
    expect(statusFromSessionStatus(undefined)).toBe("done");
  });
});
