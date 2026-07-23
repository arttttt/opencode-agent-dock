# opencode-agent-dock

> Status: **skeleton / work-in-progress**. Architecture and wiring are in place;
> the verify-items below remain before it renders live subagents correctly.

An [OpenCode](https://opencode.ai) **TUI plugin** that adds a **Claude-Code-style
bottom panel** grouping the current session's **subagents** — with select,
switch, and open-session. Not in the right sidebar: rendered in the `app_bottom`
slot, which sits below the active route in the session view.

```
▸ ● general-purpose  Verify error-tile reactivity and guards   3m 25s
  ○ explore          Audit round-3 test quality                 45s
  ✓ librarian        Lookup JWT docs
```

## Why

Subagents only surface inside the chat, and the chat scrolls away from where
they were spawned. The existing opencode subagent plugins put their list in the
**right sidebar** and are heavy. This plugin targets the **bottom** (like Claude
Code's agent panel) and stays as a single lean plugin.

## Install

TUI plugins are configured in `tui.json`. Add the plugin, then restart OpenCode:

```jsonc
// ~/.config/opencode/tui.json
{
  "plugin": ["opencode-agent-dock"]
}
```

Local development:

```jsonc
{
  "plugin": [["file:///absolute/path/to/opencode-agent-dock/src/index.tsx"]]
}
```

## Keybindings

| Key | Action |
| --- | --- |
| `alt+a` | Focus the dock |
| `k` / `j` | Previous / next subagent |
| `enter` | Open the selected subagent's session |
| `esc` | Leave the dock |

## Architecture

Clean Architecture, by analogy with
[`opencode-auto-vision`](https://github.com/arttttt/opencode-auto-vision):
dependencies point inward, the domain is pure, and the only thing that knows
about the opencode SDK / TUI API is the composition root + adapters.

```
src/
  domain.ts                              pure: Subagent, selection math, formatting
  ports.ts                               SubagentStore, SessionNavigator, Logger
  sdk.ts                                 SDK Session/SessionStatus -> domain Subagent
  constants.ts                           plugin id, slot name, keybinds, limits
  adapters/
    opencode-subagent-store.ts           SubagentStore via client.session.children + events
    opencode-navigator.ts                SessionNavigator via route.navigate
    opencode-logger.ts                   Logger via client.app.log
  view/
    Dock.tsx                             Solid render into the app_bottom slot
  index.tsx                              composition root + tui entry ({ id, tui })
```

### Data flow

`api.route.current` resolves the active parent session →
`client.session.children({ sessionID })` returns its child sessions → each is
projected to a domain `Subagent` and status is read from
`api.state.session.status(id)` → `Dock` renders rows in `app_bottom`.
Selection is owned by the root; `enter` calls `route.navigate("session", …)`.

## Verify before release

- [ ] `client.session.children` response shape (`result.data`) and namespace.
- [ ] `Session.time.created` field name for elapsed-time origin.
- [ ] `app_bottom` slot `SolidPlugin` shape from `@opentui/solid` (cast today).
- [ ] Focus handling: pushing `agent-dock` mode reliably captures `j/k/enter`.
- [ ] Map terminal subagent states to `done` vs `error` (status `undefined` is
      treated as `done` for now).

## Develop

```sh
npm install
npm run typecheck
```

OpenCode runs on Bun and loads `.ts`/`.tsx` natively, so there is no build step
for local file-plugin use.

## License

MIT © Artem Bambalov
