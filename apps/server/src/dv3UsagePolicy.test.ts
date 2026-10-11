// fork(ch-iwi): the Usage page reads no history from providers the DV³ allowlist blocks.
// @effect-diagnostics nodeBuiltinImport:off - the test seeds real transcript and login files.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import {
  ProviderDriverKind,
  ProviderInstanceId,
  UsageDay,
  type UsageSummaryInput,
} from "@t3tools/contracts";
import * as CursorAccountReader from "@t3tools/provider-cursor/server/CursorAccountReader";
import * as CursorUsageAccounts from "@t3tools/provider-cursor/server/CursorUsageAccounts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpClient, HttpClientResponse } from "effect/http";

import * as ServerSecretStore from "./auth/ServerSecretStore.ts";
import * as BackgroundPolicy from "./background/BackgroundPolicy.ts";
import * as ServerConfig from "./config.ts";
import { Dv3UsagePolicyLive } from "./dv3UsagePolicy.ts";
import * as AntigravityUsage from "./provider/Drivers/AntigravityUsage.ts";
import * as ProviderHostLive from "./provider/ProviderHostLive.ts";
import * as ServerSettings from "./serverSettings.ts";
import * as UsageService from "./usage/UsageService.ts";

const WINDOW: UsageSummaryInput = {
  timeZone: "UTC",
  sinceDay: UsageDay.make("2026-07-31"),
  untilDay: UsageDay.make("2026-08-02"),
};

const writeFile = (path: string, contents: string) =>
  Effect.promise(async () => {
    await NodeFSP.mkdir(NodePath.dirname(path), { recursive: true });
    await NodeFSP.writeFile(path, contents);
  });

/** A home with Claude and Codex transcripts and a saved Cursor login. */
const seedHome = Effect.gen(function* () {
  const home = yield* Effect.promise(() =>
    NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "dv3-usage-policy-")),
  );
  yield* Effect.addFinalizer(() =>
    Effect.promise(() => NodeFSP.rm(home, { recursive: true, force: true })),
  );
  yield* writeFile(
    NodePath.join(home, "claude", "projects", "proj", "session.jsonl"),
    `${JSON.stringify({
      type: "assistant",
      timestamp: "2026-08-01T10:00:00Z",
      requestId: "req_1",
      sessionId: "session-1",
      message: {
        id: "msg_1",
        model: "claude-fable-5",
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    })}\n`,
  );
  yield* writeFile(NodePath.join(home, "codex", "sessions", "2026", "08", "01", "r.jsonl"), "");
  yield* writeFile(NodePath.join(home, "config", "cursor", "auth.json"), "{}");
  return home;
});

const makeService = (home: string, cursorReads: { count: number }) =>
  UsageService.make.pipe(
    Effect.provide(
      Layer.fresh(CursorUsageAccounts.layer).pipe(
        Layer.provide(
          Layer.succeed(CursorAccountReader.CursorAccountReader, {
            read: () =>
              Effect.sync(() => {
                cursorReads.count += 1;
                return { accountKey: "account", records: [], missing: false, error: null };
              }),
          }),
        ),
        Layer.provideMerge(AntigravityUsage.layer),
        Layer.provideMerge(ProviderHostLive.layer),
        Layer.provideMerge(Layer.mock(BackgroundPolicy.BackgroundPolicy)({})),
        Layer.provideMerge(Layer.mock(ServerSecretStore.ServerSecretStore)({})),
        Layer.provideMerge(ServerConfig.layerTest(process.cwd(), NodePath.join(home, "state"))),
        Layer.provideMerge(NodeServices.layer),
        Layer.provideMerge(Layer.succeed(HostProcess.Platform, "linux")),
        Layer.provideMerge(
          ServerSettings.layerTest({
            providerInstances: {
              [ProviderInstanceId.make("claudeAgent")]: {
                driver: ProviderDriverKind.make("claudeAgent"),
                config: { homePath: NodePath.join(home, "claude") },
              },
              [ProviderInstanceId.make("codex")]: {
                driver: ProviderDriverKind.make("codex"),
                config: { homePath: NodePath.join(home, "codex") },
              },
            },
          }),
        ),
        Layer.provideMerge(
          Layer.succeed(
            HttpClient.HttpClient,
            HttpClient.make((request) =>
              Effect.succeed(HttpClientResponse.fromWeb(request, Response.json({}))),
            ),
          ),
        ),
        Layer.provideMerge(
          Layer.succeed(HostProcess.Environment, {
            HOME: home,
            XDG_CONFIG_HOME: NodePath.join(home, "config"),
            AGENT_CLI_CREDENTIAL_STORE: "file",
          }),
        ),
      ),
    ),
  );

const providersOf = (summary: {
  readonly sources: readonly { fingerprint: { provider: string } }[];
}) => new Set(summary.sources.map((source) => source.fingerprint.provider));

it.live("reads only allowed providers' usage under the DV³ policy", () =>
  Effect.gen(function* () {
    const home = yield* seedHome;

    // Upstream behavior, for contrast: blocked providers are read too.
    const unrestrictedReads = { count: 0 };
    const unrestricted = yield* makeService(home, unrestrictedReads);
    const before = yield* unrestricted.readSummary({ ...WINDOW, awaitRefresh: true });
    assert.isTrue(providersOf(before).has("codex"));
    assert.isTrue(providersOf(before).has("cursor"));
    assert.isAbove(unrestrictedReads.count, 0);

    const cursorReads = { count: 0 };
    const restricted = yield* makeService(home, cursorReads).pipe(
      Effect.provide(Dv3UsagePolicyLive),
    );
    const summary = yield* restricted.readSummary({ ...WINDOW, awaitRefresh: true });
    assert.deepStrictEqual([...providersOf(summary)], ["claude"]);
    assert.strictEqual(cursorReads.count, 0);
    assert.isAbove(
      summary.buckets.reduce((sum, bucket) => sum + bucket.totals.outputTokens, 0),
      0,
    );
  }).pipe(Effect.scoped),
);
