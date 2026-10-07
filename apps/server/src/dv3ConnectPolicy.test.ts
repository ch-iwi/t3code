// fork(ch-iwi): T3 Connect entry points stay closed without Connect config.
import { RelayClient } from "@t3tools/shared/relayClient";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as CloudLink from "./cloud/CloudLink.ts";
import { withDv3CloudLinkPolicy, withDv3RelayClientPolicy } from "./dv3ConnectPolicy.ts";

const reached = new Set<string>();

// Each inner method records that it ran, then stops: the tests only ask whether the
// policy let a call through.
const reach = (name: string) => () =>
  Effect.sync(() => reached.add(name)).pipe(Effect.andThen(Effect.die("inner")));
const innerCloudLink = Layer.succeed(CloudLink.CloudLink, {
  linkProof: reach("linkProof"),
  applyRelayConfig: reach("applyRelayConfig"),
  unlink: reach("unlink"),
} as unknown as CloudLink.CloudLink["Service"]);

const innerRelayClient = Layer.succeed(
  RelayClient,
  RelayClient.of({
    resolve: Effect.die("unused"),
    install: Effect.sync(() => reached.add("install")).pipe(Effect.andThen(Effect.die("inner"))),
    installWithProgress: () =>
      Effect.sync(() => reached.add("installWithProgress")).pipe(
        Effect.andThen(Effect.die("inner")),
      ),
  }),
);

it.effect("refuses to sign or store a relay link without Connect config", () =>
  Effect.gen(function* () {
    reached.clear();
    const cloudLink = yield* CloudLink.CloudLink;
    const proof = yield* Effect.flip(cloudLink.linkProof({} as never, {} as never));
    const config = yield* Effect.flip(cloudLink.applyRelayConfig({} as never));
    yield* Effect.exit(cloudLink.unlink());

    assert.instanceOf(proof, CloudLink.CloudLinkInternalError);
    assert.instanceOf(config, CloudLink.CloudLinkInternalError);
    assert.deepEqual([...reached], ["unlink"], "unlinking stays available");
  }).pipe(Effect.provide(withDv3CloudLinkPolicy(innerCloudLink, false))),
);

it.effect("lets linking through when Connect is configured", () =>
  Effect.gen(function* () {
    reached.clear();
    const cloudLink = yield* CloudLink.CloudLink;
    yield* Effect.exit(cloudLink.applyRelayConfig({} as never));
    assert.deepEqual([...reached], ["applyRelayConfig"]);
  }).pipe(Effect.provide(withDv3CloudLinkPolicy(innerCloudLink, true))),
);

it.effect("refuses to download cloudflared without Connect config", () =>
  Effect.gen(function* () {
    reached.clear();
    const relayClient = yield* RelayClient;
    const install = yield* Effect.flip(relayClient.install);
    const withProgress = yield* Effect.flip(relayClient.installWithProgress(() => Effect.void));

    assert.equal(install._tag, "RelayClientInstallError");
    assert.equal(withProgress._tag, "RelayClientInstallError");
    assert.deepEqual([...reached], []);
  }).pipe(Effect.provide(withDv3RelayClientPolicy(innerRelayClient, false))),
);
