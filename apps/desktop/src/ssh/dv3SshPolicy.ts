// fork(ch-iwi): DV³ Code does not launch servers over SSH.
//
// Upstream's SSH setup has the remote host download the `t3` release archive for
// this app's version from pingdotgg/t3code, which would run upstream T3 Code there
// (no provider allowlist, telemetry on). The fork publishes no such archives, so
// setup is refused; a server started on the host can still be paired by link.
import { SshLaunchError } from "@t3tools/ssh/errors";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DesktopSshEnvironment } from "./DesktopSshEnvironment.ts";

export const DV3_SSH_DISABLED_MESSAGE =
  "DV³ Code cannot set up SSH environments, because that would install upstream T3 Code on the remote host. Start a server there and pair it with a link instead.";

/** Keeps host discovery and disconnect, and refuses to launch a remote server. */
export const withDv3SshPolicy = <E, R>(
  layer: Layer.Layer<DesktopSshEnvironment, E, R>,
): Layer.Layer<DesktopSshEnvironment, E, R> =>
  Layer.effect(
    DesktopSshEnvironment,
    Effect.gen(function* () {
      const inner = yield* DesktopSshEnvironment;
      return DesktopSshEnvironment.of({
        ...inner,
        ensureEnvironment: () =>
          Effect.fail(new SshLaunchError({ message: DV3_SSH_DISABLED_MESSAGE, stdout: "" })),
      });
    }),
  ).pipe(Layer.provide(layer));
