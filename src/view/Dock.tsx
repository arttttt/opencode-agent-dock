/** @jsxImportSource @opentui/solid */
// View — DIAGNOSTIC build. Always visible (no <Show>), with a self-incrementing
// tick signal + a createEffect probe, to determine whether Solid reactivity
// inside an `app_bottom` slot contribution reaches the host renderer at all.
//
// Read the screen + the log:
//  - if the on-screen "tick N" number advances every second  -> reactivity works
//    (the real bug is then in store wiring / <Show>, fixable here).
//  - if "tick" stays at 0, yet `dock effect tick=N` logs advance in the log
//    -> our signal updates but the host renderer ignores it (dual Solid instance
//    or static slot render) -> must change the reactivity source.

import { For, createEffect, createSignal, onCleanup, type JSX } from "solid-js";
import type { RGBA } from "@opentui/core";
import type { SubagentStore } from "../ports.js";
import { LIMITS } from "../constants.js";

export type DockColors = {
  text: RGBA | string;
  muted: RGBA | string;
  accent: RGBA | string;
};

export type DockProps = {
  store: SubagentStore;
  colors: DockColors;
  log?: (message: string) => void;
};

export function Dock(props: DockProps): JSX.Element {
  const [tick, setTick] = createSignal(0);
  const timer = setInterval(() => setTick((t) => t + 1), LIMITS.pollMs);
  onCleanup(() => clearInterval(timer));

  // Reactivity probe: re-runs only if the host tracks our solid-js signal.
  createEffect(() => {
    props.log?.(`dock effect tick=${tick()} rows=${props.store.snapshot().length}`);
  });

  const rows = () => props.store.snapshot();

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1}>
      <text fg={props.colors.accent}>{`agent-dock \u25cf tick ${tick()} \u00b7 rows ${rows().length}`}</text>
      <For each={rows()}>
        {(subagent) => <text fg={props.colors.muted}>{`  ${subagent.title.slice(0, LIMITS.labelMax)}`}</text>}
      </For>
    </box>
  );
}
