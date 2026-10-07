#!/usr/bin/env node
// Prints DV³ Code's version, or bumps it: `node scripts/dv3-version.ts [major|minor|patch]`.
// See scripts/lib/dv3-build-version.ts for how builds turn it into a version.
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { Argument, Command } from "effect/cli";
import { fromJsonStringPretty } from "@t3tools/shared/schemaJson";

import { DV3_VERSION_FILE, Dv3BuildVersionError, bumpDv3Version } from "./lib/dv3-build-version.ts";

const Dv3VersionFileJson = fromJsonStringPretty(Schema.Struct({ version: Schema.String }));
const decodeDv3VersionFile = Schema.decodeUnknownEffect(Dv3VersionFileJson);
const encodeDv3VersionFile = Schema.encodeEffect(Dv3VersionFileJson);

export const dv3VersionCommand = Command.make(
  "dv3-version",
  {
    part: Argument.Literals("part", ["major", "minor", "patch"]).pipe(
      Argument.withDescription("Version part to bump. Prints the current version when omitted."),
      Argument.optional,
    ),
  },
  Effect.fn(function* ({ part }) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const filePath = path.resolve(import.meta.dirname, "..", DV3_VERSION_FILE);
    const { version } = yield* decodeDv3VersionFile(yield* fs.readFileString(filePath));
    if (Option.isNone(part)) {
      return yield* Console.log(version);
    }

    const next = bumpDv3Version(version, part.value);
    if (!next) {
      return yield* new Dv3BuildVersionError({
        reason: `${DV3_VERSION_FILE} must hold a major.minor.patch version, got "${version}".`,
      });
    }
    yield* fs.writeFileString(filePath, `${yield* encodeDv3VersionFile({ version: next })}\n`);
    yield* Console.log(`${version} -> ${next}`);
  }),
).pipe(Command.withDescription("Print or bump DV³ Code's version."));

if (import.meta.main) {
  Command.run(dv3VersionCommand, { version: "0.0.0" }).pipe(
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
  );
}
