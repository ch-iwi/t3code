// DV³ Code versions its desktop app from `dv3-version.json`, not upstream's version.
// Release builds (DV3_RELEASE=true) use it as is; others are `<version>-dv3.<date>.<count>`,
// with date and count taken from HEAD so CI and local builds of a commit agree.
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import dv3VersionFile from "../../dv3-version.json" with { type: "json" };

export const DV3_VERSION_FILE = "dv3-version.json";

export type Dv3VersionPart = "major" | "minor" | "patch";

export class Dv3BuildVersionError extends Schema.TaggedError<Dv3BuildVersionError>()(
  "Dv3BuildVersionError",
  {
    reason: Schema.String,
  },
) {
  override get message(): string {
    return this.reason;
  }
}

const CORE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseCoreVersion(version: string): [number, number, number] | undefined {
  const match = CORE_VERSION.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

/** The next version after bumping `part`, resetting the parts below it. */
export function bumpDv3Version(version: string, part: Dv3VersionPart): string | undefined {
  const parsed = parseCoreVersion(version);
  if (!parsed) return undefined;
  const [major, minor, patch] = parsed;
  switch (part) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

export function formatDv3PrereleaseVersion(input: {
  readonly version: string;
  readonly commitTime: DateTime.DateTime;
  readonly commitCount: number;
}): string {
  const date = DateTime.formatIsoDateUtc(input.commitTime).replaceAll("-", "");
  return `${input.version}-dv3.${date}.${input.commitCount}`;
}

export const resolveDv3BuildVersion = Effect.fn("resolveDv3BuildVersion")(function* (
  repoRoot: string,
) {
  const version = dv3VersionFile.version;
  if (!parseCoreVersion(version)) {
    return yield* new Dv3BuildVersionError({
      reason: `${DV3_VERSION_FILE} must hold a major.minor.patch version, got "${version}".`,
    });
  }
  if (yield* Config.Boolean("DV3_RELEASE").pipe(Config.withDefault(false))) {
    return version;
  }

  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const git = (...args: ReadonlyArray<string>) =>
    spawner
      .string(ChildProcess.make("git", args, { cwd: repoRoot }))
      .pipe(Effect.map((output) => output.trim()));

  // A shallow clone counts only the commits it fetched.
  if ((yield* git("rev-parse", "--is-shallow-repository")) === "true") {
    return yield* new Dv3BuildVersionError({
      reason:
        "DV³ build versions count the commits on HEAD, which needs the full history. Run `git fetch --unshallow` or set DV3_RELEASE=true.",
    });
  }
  const commitCount = Number(yield* git("rev-list", "--count", "HEAD"));
  const commitSeconds = Number(yield* git("show", "-s", "--format=%ct", "HEAD"));
  if (!Number.isInteger(commitCount) || commitCount < 1 || !Number.isInteger(commitSeconds)) {
    return yield* new Dv3BuildVersionError({
      reason: "Could not read HEAD's commit count and date from git.",
    });
  }

  return formatDv3PrereleaseVersion({
    version,
    commitTime: DateTime.makeUnsafe(commitSeconds * 1000),
    commitCount,
  });
});
