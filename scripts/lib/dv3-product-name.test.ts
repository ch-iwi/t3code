import { describe, expect, it } from "vite-plus/test";

import { rebrandProductName } from "./dv3-product-name.ts";

describe("rebrandProductName", () => {
  it.each([
    ['"Restart T3 Code to finish."', '"Restart DV³ Code to finish."'],
    ["`Update the T3 Code desktop app`", "`Update the DV³ Code desktop app`"],
    ['children:"T3 Code"', 'children:"DV³ Code"'],
    ['"based on T3 Code ",v', '"based on T3 Code ",v'],
    ['"would install upstream T3 Code on"', '"would install upstream T3 Code on"'],
    ['"T3 Code\'s privacy policy."', '"T3 Code\'s privacy policy."'],
    ["'T3 Code\\'s privacy policy.'", "'T3 Code\\'s privacy policy.'"],
    ['"T3 Connect" "T3Code/policy.json"', '"T3 Connect" "T3Code/policy.json"'],
  ])("%s", (input, expected) => {
    expect(rebrandProductName(input)).toBe(expected);
  });
});
