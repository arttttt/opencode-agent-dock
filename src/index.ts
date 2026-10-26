// Composition root — the package's ./tui entry. The host adapter lives in hosts/.

import { PLUGIN_ID } from "./constants.js";
import { openCodeV1Tui } from "./hosts/opencode-v1.js";

const plugin = {
  id: PLUGIN_ID,
  tui: openCodeV1Tui,
};

export default plugin;
