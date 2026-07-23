/** @jsxImportSource @opentui/solid */
// View — the bottom-panel render. A Solid component contributed to the
// `app_bottom` slot. Holds no domain logic: it reads the SubagentStore and
// derives rows via the pure domain `toRow`. Hides entirely when there are no
// subagents (renders nothing — no empty-state text).

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
  colors: DockColors;
};

export function Dock(props: DockProps): JSX.Element {
  // Re-render on store changes and on a slow tick so elapsed times stay fresh.
  const [, bump] = createSignal(0);
  const rerender = () => bump((n) => n + 1);
  const unsubscribe = props.store.onChange(rerender);
  const timer = setInterval(rerender, LIMITS.pollMs);
  onCleanup(() => {
    unsubscribe();
    clearInterval(timer);
  });

  const rows = createMemo(() => {
    rerender(); // dependency on the bump signal
    const now = Date.now();
    return props.store.snapshot().map((subagent) => toRow(subagent, now, LIMITS.labelMax));
  });

  return (
    <Show when={rows().length > 0}>
      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        <For each={rows()}>
          {(row) => (
            <text fg={row.subagent.status === "running" ? props.colors.accent : props.colors.muted}>
              {`${row.glyph} ${row.label}${row.elapsed ? "  " + row.elapsed : ""}`}
            </text>
          )}
        </For>
      </box>
    </Show>
  );
}
