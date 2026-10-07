// fork(ch-iwi): DV³ Code sends no usage data unless T3CODE_TELEMETRY_ENABLED=true.
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { HostProcessArchitecture, HostProcessPlatform } from "@t3tools/shared/hostProcess";

import * as ServerConfig from "./config.ts";
import * as AnalyticsService from "./telemetry/AnalyticsService.ts";

const recordAndFlush = (env: Record<string, unknown>) =>
  Effect.gen(function* () {
    const capturedPaths: Array<string> = [];
    const layerBatchServer = HttpServer.serve(
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        capturedPaths.push(request.url);
        return HttpServerResponse.jsonUnsafe({});
      }),
    );
    const layerRuntime = AnalyticsService.layer.pipe(
      Layer.provideMerge(
        ServerConfig.ServerConfig.layerTest(process.cwd(), { prefix: "t3-dv3-telemetry-" }),
      ),
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            T3CODE_POSTHOG_KEY: "phc_test_key",
            T3CODE_POSTHOG_HOST: "http://localhost",
            ...env,
          }),
        ),
      ),
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(HostProcessPlatform, "darwin"),
          Layer.succeed(HostProcessArchitecture, "arm64"),
        ),
      ),
      Layer.provideMerge(NodeHttpServer.layerTest),
    );

    yield* Effect.gen(function* () {
      yield* Layer.launch(layerBatchServer).pipe(Effect.forkScoped);
      const analytics = yield* AnalyticsService.AnalyticsService;
      yield* analytics.record("test.dv3", { index: 1 });
      yield* analytics.flush;
    }).pipe(Effect.provide(layerRuntime));

    return capturedPaths;
  });

it.layer(NodeServices.layer)("DV³ telemetry default", (it) => {
  it.effect("sends nothing when T3CODE_TELEMETRY_ENABLED is unset", () =>
    Effect.gen(function* () {
      assert.deepEqual(yield* recordAndFlush({}), []);
    }),
  );

  it.effect("still sends when T3CODE_TELEMETRY_ENABLED=true opts in", () =>
    Effect.gen(function* () {
      const paths = yield* recordAndFlush({ T3CODE_TELEMETRY_ENABLED: true });
      assert.equal(paths.length, 1);
      assert.isTrue(paths[0]?.endsWith("/batch/"));
    }),
  );
});
