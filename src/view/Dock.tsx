/** @jsxImportSource @opentui/solid */
// View — the bottom-panel render. A Solid component contributed to the
// `app_bottom` slot. Reads the SubagentStore and derives rows via the pure
// domain `toRow`. Hides entirely when there are no running subagents.
//
// Reactivity: the memo READS the version signal (`version()`) so Solid tracks
// it. (Calling the setter inside the memo does not register a dependency — the
// earlier bug that kept the panel hidden once data arrived.)

import { For, Show, createMemo, createSignal, onCleanup, type JSX } from "solid-js";
import type { RGBA } from "@opentui/core";
import type { SubagentStore } from "../ports.js";
import { toRow } from "../domain.js";
import { LIMITS } from "../constants.js";

export type DockColors = {
  text: RGBA | string;
  muted: RGBA | string;
  accent: RGBA | string;
  border: RGBA | string;
  panel: RGBA | string;
};

export type DockProps = {
  store: SubagentStore;
  colors: DockColors;
};

export function Dock(props: DockProps): JSX.Element {
  const [version, setVersion] = createSignal(0);
  const bump = () => setVersion((value) => value + 1);
  const unsubscribe = props.store.onChange(bump);
  const timer = setInterval(bump, LIMITS.pollMs);
  onCleanup(() => {
    unsubscribe();
    clearInterval(timer);
  });

  const rows = createMemo(() => {
    version(); // READ — the reactive dependency
    const now = Date.now();
    return props.store.snapshot().map((subagent) => toRow(subagent, now, LIMITS.labelMax));
  });

  return (
    <Show when={rows().length > 0}>
      <box
        flexDirection="column"
        width="100%"
        border
        borderColor={props.colors.border}
        backgroundColor={props.colors.panel}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={props.colors.muted}>{`Subagents \u00b7 ${rows().length}`}</text>
        <For each={rows()}>
          {(row) => (
            <text fg={row.subagent.status === "running" ? props.colors.accent : props.colors.text}>
              {`${row.glyph} ${row.label}${row.elapsed ? "  " + row.elapsed : ""}`}
            </text>
          )}
        </For>
      </box>
    </Show>
  );
}
