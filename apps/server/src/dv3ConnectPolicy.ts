// fork(ch-iwi): T3 Connect stays off unless this server carries Connect config.
//
// The desktop build ships without a relay URL or Clerk keys, so every client hides
// Connect. These wrappers also refuse the server paths a client could still call:
// storing a relay link (which the startup code would then reuse) and downloading
// cloudflared.
import { RelayClient, RelayClientInstallError } from "@t3tools/shared/relayClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as CloudLink from "./cloud/CloudLink.ts";
import { hasCloudPublicConfig } from "./cloud/publicConfig.ts";

const notConfigured = () =>
  Effect.fail(new CloudLink.CloudLinkInternalError({ operation: "relay-url-unconfigured" }));

/** Refuses to sign or store a relay link without Connect config. */
export const withDv3CloudLinkPolicy = <E, R>(
  layer: Layer.Layer<CloudLink.CloudLink, E, R>,
  connectConfigured: boolean = hasCloudPublicConfig,
): Layer.Layer<CloudLink.CloudLink, E, R> =>
  connectConfigured
    ? layer
    : Layer.effect(
        CloudLink.CloudLink,
        Effect.gen(function* () {
          const inner = yield* CloudLink.CloudLink;
          return CloudLink.CloudLink.of({
            ...inner,
            linkProof: notConfigured,
            applyRelayConfig: notConfigured,
          });
        }),
      ).pipe(Layer.provide(layer));

/** Refuses to download cloudflared without Connect config. */
export const withDv3RelayClientPolicy = <E, R>(
  layer: Layer.Layer<RelayClient, E, R>,
  connectConfigured: boolean = hasCloudPublicConfig,
): Layer.Layer<RelayClient, E, R> => {
  if (connectConfigured) return layer;
  const blocked = Effect.fail(
    new RelayClientInstallError({
      reason: "unsupported_platform",
      message: "T3 Connect is not available in DV³ Code.",
    }),
  );
  return Layer.effect(
    RelayClient,
    Effect.gen(function* () {
      const inner = yield* RelayClient;
      return RelayClient.of({ ...inner, install: blocked, installWithProgress: () => blocked });
    }),
  ).pipe(Layer.provide(layer));
};
