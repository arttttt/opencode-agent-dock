// Composition root — the package's ./tui entry, read by both OpenCode TUIs.
//
// One default object passes both loaders: OpenCode 1 (1.18+) reads `tui` and
// ignores `setup` (readV1Plugin rejects only server + tui together); OpenCode 2
// reads `id` + `setup` and ignores `tui`. Each host adapter lives in hosts/.

import { PLUGIN_ID } from "./constants.js";
import { openCodeV1Tui } from "./hosts/opencode-v1.js";
import { openCodeV2Setup } from "./hosts/opencode-v2.js";

const plugin = {
  id: PLUGIN_ID,
  tui: openCodeV1Tui,
  setup: openCodeV2Setup,
};

export default plugin;
