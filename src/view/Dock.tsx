/** @jsxImportSource @opentui/solid */
// View — the bottom-panel render, Claude-Code-style: no bordered panel, just
// clean text rows aligned under the prompt. Status glyph in accent, the rest
// muted. Each row is clickable to open that subagent's session.
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
};

export type DockProps = {
  store: SubagentStore;
  colors: DockColors;
  open?: (sessionId: string) => void;
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
      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        <For each={rows()}>
          {(row) => (
            <box flexDirection="row" onMouseUp={() => props.open?.(row.subagent.id)}>
              <text>
                <span style={{ fg: row.subagent.status === "running" ? props.colors.accent : props.colors.muted }}>
                  {row.glyph}
                </span>
                <span style={{ fg: props.colors.muted }}>
                  {` ${row.label}${row.elapsed ? "  " + row.elapsed : ""}`}
                </span>
              </text>
            </box>
          )}
        </For>
      </box>
    </Show>
  );
}
