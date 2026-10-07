import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { bumpDv3Version, formatDv3PrereleaseVersion } from "./dv3-build-version.ts";

describe("bumpDv3Version", () => {
  it("resets the parts below the bumped one", () => {
    expect(bumpDv3Version("1.4.7", "major")).toBe("2.0.0");
    expect(bumpDv3Version("1.4.7", "minor")).toBe("1.5.0");
    expect(bumpDv3Version("1.4.7", "patch")).toBe("1.4.8");
  });

  it("rejects versions that are not major.minor.patch", () => {
    expect(bumpDv3Version("1.4", "patch")).toBeUndefined();
    expect(bumpDv3Version("1.4.7-dv3.20261007.12", "patch")).toBeUndefined();
    expect(bumpDv3Version("01.4.7", "patch")).toBeUndefined();
  });
});

describe("formatDv3PrereleaseVersion", () => {
  it("uses the commit's UTC date and the commit count", () => {
    expect(
      formatDv3PrereleaseVersion({
        version: "1.2.0",
        commitTime: DateTime.makeUnsafe("2026-10-07T23:30:00-02:00"),
        commitCount: 4954,
      }),
    ).toBe("1.2.0-dv3.20261008.4954");
  });
});
