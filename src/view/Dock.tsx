/** @jsxImportSource @opentui/solid */
// View — the bottom-panel render. A Solid component rendered into the
// `app_bottom` slot. Holds no domain logic: it reads the SubagentStore and
// derives rows via the pure domain `toRow`. Selection state is owned by the
// composition root and passed in.

import { For, createMemo, createSignal, onCleanup, type JSX } from "solid-js";
import type { SubagentStore } from "../ports.js";
import { toRow } from "../domain.js";
import { LIMITS } from "../constants.js";

export type DockProps = {
  store: SubagentStore;
  selection: () => number;
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

  const line = (index: number, glyph: string, label: string, elapsed: string): string => {
    const cursor = index === props.selection() ? "▸ " : "  ";
    return `${cursor}${glyph} ${label}${elapsed ? "  " + elapsed : ""}`;
  };

  return (
    <box>
      <text>{"Agents"}</text>
      <For each={rows()}>
        {(row, index) => <text>{line(index(), row.glyph, row.label, row.elapsed)}</text>}
      </For>
      {rows().length === 0 ? <text>{"  no subagents"}</text> : null}
    </box>
  );
}
