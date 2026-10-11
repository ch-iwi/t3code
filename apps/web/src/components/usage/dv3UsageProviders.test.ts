// fork(ch-iwi): the Usage filter menu hides providers the DV³ allowlist blocks.
import { describe, expect, it } from "vite-plus/test";

import { dv3FilterMenuProviders } from "./dv3UsageProviders";

describe("dv3FilterMenuProviders", () => {
  it("offers only allowed providers when nothing else reports usage", () => {
    expect(dv3FilterMenuProviders([], new Set())).toEqual(["claude"]);
  });

  it("keeps a blocked provider that an environment reports usage for", () => {
    expect(dv3FilterMenuProviders(["codex", "claude"], new Set())).toEqual(["codex", "claude"]);
  });

  it("keeps a hidden blocked provider so it can be shown again", () => {
    expect(dv3FilterMenuProviders([], new Set(["cursor"]))).toEqual(["claude", "cursor"]);
  });
});
