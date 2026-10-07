// fork(ch-iwi): DV³ Code never launches a server over SSH.
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DesktopSshEnvironment } from "./DesktopSshEnvironment.ts";
import { DV3_SSH_DISABLED_MESSAGE, withDv3SshPolicy } from "./dv3SshPolicy.ts";

const reached: Array<string> = [];
const inner = Layer.succeed(
  DesktopSshEnvironment,
  DesktopSshEnvironment.of({
    discoverHosts: () => Effect.sync(() => (reached.push("discoverHosts"), [])),
    resolveHost: () => Effect.die("unused"),
    ensureEnvironment: () =>
      Effect.sync(() => reached.push("ensureEnvironment")).pipe(
        Effect.andThen(Effect.die("inner")),
      ),
    disconnectEnvironment: () => Effect.die("unused"),
  }),
);

it.effect("refuses SSH environment setup and keeps host discovery", () =>
  Effect.gen(function* () {
    const ssh = yield* DesktopSshEnvironment;
    yield* ssh.discoverHosts();
    const error = yield* Effect.flip(
      ssh.ensureEnvironment({ alias: "devbox", hostname: "devbox", username: null, port: null }),
    );

    assert.equal(error._tag, "SshLaunchError");
    assert.equal(error.message, DV3_SSH_DISABLED_MESSAGE);
    assert.deepEqual(reached, ["discoverHosts"]);
  }).pipe(Effect.provide(withDv3SshPolicy(inner))),
);
