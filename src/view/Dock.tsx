/** @jsxImportSource @opentui/solid */
// View — the persistent bottom panel (app_bottom slot). Claude-Code-style:
// plain text rows under the prompt, no panel chrome. Stays visible in both the
// parent session (running subagents) and inside a subagent (the focused one,
// highlighted via `activeId`). When the dock is focused for inline navigation,
// the selected row gets a `▸` cursor.
//
// Reactivity: `selection`, `focused`, `activeId` are real Solid signals (owned
// by the composition root), so per-row selected/active checks are tracked
// directly — no signal-reading hacks. The rows memo additionally reads the
// `version` signal (bumped on every store change) so elapsed times stay fresh.

import { For, Show, createMemo, createSignal, onCleanup, type JSX } from "solid-js";
import type { RGBA } from "@opentui/core";
import type { SubagentStore } from "../ports.js";
import { toRow } from "../domain.js";
import { LIMITS } from "../constants.js";

export type DockColors = {
  text: RGBA | string;
  muted: RGBA | string;
  accent: RGBA | string;
};

export type DockProps = {
  store: SubagentStore;
  selection: () => number;
  focused: () => boolean;
  activeId: () => string | undefined;
  colors: DockColors;
};

export function Dock(props: DockProps): JSX.Element {
  // The store emits on every refresh (data change + elapsed tick), which bumps
  // `version` and re-runs the rows memo. No separate timer needed here.
  const [version, setVersion] = createSignal(0);
  const unsubscribe = props.store.onChange(() => setVersion((value) => value + 1));
  onCleanup(unsubscribe);

  const rows = createMemo(() => {
    version();
    const now = Date.now();
    return props.store.snapshot().map((subagent) => toRow(subagent, now, LIMITS.labelMax));
  });

  return (
    <Show when={rows().length > 0}>
      <box flexDirection="column" paddingLeft={2} paddingRight={2}>
        <For each={rows()}>
          {(row, index) => {
            const selected = () => props.focused() && index() === props.selection();
            const active = () => props.activeId() === row.subagent.id;
            const hot = () => selected() || active();
            return (
              <text>
                <span style={{ fg: hot() ? props.colors.accent : props.colors.muted }}>
                  {selected() ? "\u25b8 " : "  "}
                </span>
                <span style={{ fg: row.subagent.status === "running" ? props.colors.accent : props.colors.muted }}>
                  {row.glyph}
                </span>
                <span style={{ fg: hot() ? props.colors.text : props.colors.muted }}>
                  {` ${row.label}${row.meta ? "  " + row.meta : ""}`}
                </span>
              </text>
            );
          }}
        </For>
      </box>
    </Show>
  );
}
