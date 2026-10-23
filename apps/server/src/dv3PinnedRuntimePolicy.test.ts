// fork(ch-iwi): DV³ Code never downloads or installs an upstream t3 release.
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { HttpClient } from "effect/http";
import { vi } from "vite-plus/test";

import { ensurePinnedRuntimeInstalled, PinnedRuntimeInstallError } from "./cloud/pinnedRuntime.ts";
import { DV3_PINNED_RUNTIME_DISABLED_STEP } from "./dv3PinnedRuntimePolicy.ts";

vi.unmock("./dv3PinnedRuntimePolicy.ts");

it.layer(NodeServices.layer)("DV³ pinned runtime policy", (it) => {
  it.effect("refuses before any download or install", () =>
    Effect.gen(function* () {
      const touched: string[] = [];
      const record = (name: string) => () => {
        touched.push(name);
        return Effect.die(name);
      };
      const error = yield* Effect.flip(
        ensurePinnedRuntimeInstalled({
          baseDir: "/nonexistent",
          version: "1.2.3",
          fs: yield* FileSystem.FileSystem,
          path: yield* Path.Path,
          runner: { run: record("run") } as never,
          httpClient: HttpClient.make(record("http")),
          platform: "darwin",
          arch: "arm64",
          validate: record("validate"),
        }),
      );

      assert.instanceOf(error, PinnedRuntimeInstallError);
      assert.equal(error.step, DV3_PINNED_RUNTIME_DISABLED_STEP);
      assert.deepEqual(touched, []);
    }),
  );
});
