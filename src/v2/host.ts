// OpenCode 2's TUI plugin context — only the members the dock uses, written
// structurally from @opencode/plugin 2.1.4 dist/tui/context.d.ts and
// @opencode/client 2.1.4 SessionInfo. The package itself is not a dependency:
// its @opentui peer (>=0.6.8) conflicts with the OpenCode 1 one, and the host
// hands these objects in at run time anyway.

import type { JSX } from "solid-js";
import type { DockColors } from "../view/Dock.js";

/** @opencode/client SessionInfo, the fields the dock reads. */
export type V2Session = {
  readonly id: string;
  readonly parentID?: string;
  readonly agent?: string;
  readonly title?: string;
  readonly tokens: {
    readonly input: number;
    readonly output: number;
    readonly reasoning: number;
    readonly cache: { readonly read: number; readonly write: number };
  };
  readonly time: { readonly created: number; readonly archived?: number };
};

/** Context.data.session: reads of the client's live Solid store. */
export type V2SessionData = {
  get(sessionID: string): V2Session | undefined;
  /** Every session in the family of `sessionID`'s root, root included. */
  family(sessionID: string): string[];
  status(sessionID: string): "idle" | "running";
};

export type V2Route =
  | { readonly type: "home" }
  | { readonly type: "session"; readonly sessionID: string }
  | { readonly type: "plugin"; readonly id: string; readonly name: string };

export type V2Router = {
  current(): V2Route;
  navigate(destination: { readonly type: "session"; readonly sessionID: string }): void;
};

export type V2KeymapCommand = {
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly group?: string;
  readonly bind?: false | string;
  readonly palette?: true;
  readonly slash?: { readonly name: string };
  /** Return false to let dispatch continue to the next layer. */
  readonly run: (input?: string) => void | false | Promise<void>;
};

export type V2KeymapLayer = {
  readonly mode?: string;
  readonly enabled?: boolean | (() => boolean);
  readonly priority?: number;
  readonly commands?: readonly V2KeymapCommand[];
};

/** An @opentui/core RGBA, as the host's theme hands it over. */
type Color = DockColors["text"];

/** Context.theme (@opencode/theme ResolvedTheme): the colours the dock uses. */
export type V2Theme = {
  readonly text: {
    readonly base: Color;
    readonly muted: Color;
    readonly action: { readonly primary: { readonly base: Color } };
  };
};

export type V2SlotClaim = {
  readonly append: "app";
  readonly render: (input: Readonly<Record<string, never>>) => JSX.Element;
};

export type V2Context = {
  readonly data: { readonly session: V2SessionData };
  readonly theme: V2Theme;
  readonly keymap: { layer(factory: () => V2KeymapLayer): void };
  readonly ui: {
    readonly router: V2Router;
    readonly slot: (claim: V2SlotClaim) => () => void;
  };
};

export type V2Cleanup = () => void;
