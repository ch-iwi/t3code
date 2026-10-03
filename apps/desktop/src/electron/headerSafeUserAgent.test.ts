import { describe, expect, it } from "vite-plus/test";

import { toHeaderSafeUserAgent } from "./headerSafeUserAgent.ts";

describe("toHeaderSafeUserAgent", () => {
  it("makes a non-ASCII app name usable as a header value", () => {
    const userAgent = toHeaderSafeUserAgent(
      "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) DV³ Code (Alpha)/0.0.45 Chrome/140.0 Electron/38.0",
    );

    expect(userAgent).toBe(
      "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) DV3 Code (Alpha)/0.0.45 Chrome/140.0 Electron/38.0",
    );
    expect(() => new Headers({ "user-agent": userAgent })).not.toThrow();
  });

  it("leaves an ASCII User-Agent unchanged", () => {
    const userAgent = "Mozilla/5.0 T3 Code (Alpha)/0.0.45 Electron/38.0";
    expect(toHeaderSafeUserAgent(userAgent)).toBe(userAgent);
  });
});
