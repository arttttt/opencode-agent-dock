// Adapter — SessionNavigator over the TUI route API.

import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { SessionNavigator } from "../ports.js";

export function createNavigator(api: TuiPluginApi): SessionNavigator {
  return {
    open(sessionId) {
      api.route.navigate("session", { sessionID: sessionId });
    },
  };
}
