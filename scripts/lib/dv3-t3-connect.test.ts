import { describe, expect, it } from "vite-plus/test";

import { configuredT3ConnectNames } from "./dv3-t3-connect.ts";

describe("configuredT3ConnectNames", () => {
  it("finds nothing when Connect is unconfigured", () => {
    expect(
      configuredT3ConnectNames({ T3CODE_MOBILE_OTLP_TRACES_URL: "https://example.test" }),
    ).toEqual([]);
  });

  it("reports Connect values set through any alias", () => {
    expect(
      configuredT3ConnectNames({
        VITE_T3CODE_RELAY_URL: "https://relay.example.test",
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
        T3CODE_CLERK_JWT_TEMPLATE: "  ",
      }),
    ).toEqual(["T3CODE_CLERK_PUBLISHABLE_KEY", "T3CODE_RELAY_URL"]);
  });
});
