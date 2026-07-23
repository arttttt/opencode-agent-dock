// Adapter — Logger over the opencode client app log endpoint.

import type { OpencodeClient } from "@opencode-ai/sdk/v2";
import type { Logger } from "../ports.js";
import { SERVICE } from "../constants.js";

export function createLogger(client: OpencodeClient): Logger {
  const write = (level: "info" | "warn" | "error", message: string): void => {
    client.app
      .log({ service: SERVICE, level, message })
      .catch(() => {});
  };
  return {
    info: (m) => write("info", m),
    warn: (m) => write("warn", m),
    error: (m) => write("error", m),
  };
}
