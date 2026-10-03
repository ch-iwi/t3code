import {
  DEFAULT_SERVER_SETTINGS,
  ProviderDriverKind,
  ProviderInstanceId,
  type AcpRegistryPrepareResult,
  type AcpRegistrySearchAgent,
  type ServerSettings,
} from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Stream from "effect/Stream";

import {
  applyDv3ProviderPolicy,
  withDv3AcpRegistryPolicy,
  withDv3ProviderInstancePolicy,
  withDv3SettingsPolicy,
} from "./dv3ProviderPolicy.ts";
import { AcpRegistryCatalog, AcpRegistryError } from "./provider/acp/AcpRegistrySupport.ts";
import type { ProviderInstance } from "./provider/ProviderDriver.ts";
import { ProviderInstanceRegistry } from "./provider/Services/ProviderInstanceRegistry.ts";
import { layerTest as serverSettingsLayerTest, ServerSettingsService } from "./serverSettings.ts";

const id = ProviderInstanceId.make;
const driver = ProviderDriverKind.make;

const settingsWithEveryKindOfInstance: ServerSettings = {
  ...DEFAULT_SERVER_SETTINGS,
  providerInstances: {
    [id("codex_work")]: { driver: driver("codex") },
    [id("claude_work")]: { driver: driver("claudeAgent") },
    [id("junie")]: { driver: driver("acpRegistry"), config: { agentId: "junie" } },
    [id("gemini")]: { driver: driver("acpRegistry"), config: { agentId: "gemini" } },
  },
  textGenerationModelSelection: { instanceId: id("codex"), model: "gpt-6-luna" },
  defaultModelSelection: { instanceId: id("codex_work"), model: "gpt-6-luna" },
  sourceControlWriterModelSelection: { instanceId: id("claude_work"), model: "claude-haiku-4-5" },
};

describe("applyDv3ProviderPolicy", () => {
  it("keeps only allowed providers and ACP agents", () => {
    const settings = applyDv3ProviderPolicy(settingsWithEveryKindOfInstance);

    assert.deepStrictEqual(Object.keys(settings.providerInstances).toSorted(), [
      "claude_work",
      "junie",
    ]);
    assert.strictEqual(settings.providers.codex.enabled, false);
    assert.strictEqual(settings.providers.cursor.enabled, false);
    assert.strictEqual(
      settings.providers.claudeAgent.enabled,
      settingsWithEveryKindOfInstance.providers.claudeAgent.enabled,
    );
  });

  it("moves model selections off disallowed providers", () => {
    const settings = applyDv3ProviderPolicy(settingsWithEveryKindOfInstance);

    assert.strictEqual(settings.textGenerationModelSelection.instanceId, "claudeAgent");
    assert.strictEqual(settings.defaultModelSelection, null);
    assert.deepStrictEqual(
      settings.sourceControlWriterModelSelection,
      settingsWithEveryKindOfInstance.sourceControlWriterModelSelection,
    );
  });
});

describe("withDv3SettingsPolicy", () => {
  it.effect("refuses to add a disallowed provider instance", () =>
    Effect.gen(function* () {
      const settingsService = yield* ServerSettingsService;

      const error = yield* settingsService
        .updateProviderInstance({
          operation: "create",
          instanceId: id("codex_new"),
          instance: { driver: driver("codex") },
        })
        .pipe(Effect.flip);
      assert.strictEqual(error.providerInstanceId, "codex_new");
      const created = yield* settingsService.updateProviderInstance({
        operation: "create",
        instanceId: id("copilot"),
        instance: { driver: driver("acpRegistry"), config: { agentId: "github-copilot-cli" } },
      });
      assert.isDefined(created.providerInstances[id("copilot")]);
    }).pipe(Effect.provide(withDv3SettingsPolicy(serverSettingsLayerTest()))),
  );

  it.effect("serves the restricted view from the settings service", () =>
    Effect.gen(function* () {
      const settings = yield* (yield* ServerSettingsService).getSettings;

      assert.deepStrictEqual(Object.keys(settings.providerInstances).toSorted(), [
        "claude_work",
        "junie",
      ]);
      assert.strictEqual(settings.textGenerationModelSelection.instanceId, "claudeAgent");
    }).pipe(
      Effect.provide(
        withDv3SettingsPolicy(
          serverSettingsLayerTest({
            providerInstances: settingsWithEveryKindOfInstance.providerInstances,
          }),
        ),
      ),
    ),
  );
});

const fakeInstance = (instanceId: string, driverKind: string) =>
  ({ instanceId: id(instanceId), driverKind: driver(driverKind) }) as unknown as ProviderInstance;

const fakeRegistryLayer = Layer.effect(
  ProviderInstanceRegistry,
  Effect.gen(function* () {
    const changes = yield* PubSub.unbounded<void>();
    const instances = [fakeInstance("codex", "codex"), fakeInstance("claudeAgent", "claudeAgent")];
    return ProviderInstanceRegistry.of({
      getInstance: (instanceId) =>
        Effect.succeed(instances.find((instance) => instance.instanceId === instanceId)),
      listInstances: Effect.succeed(instances),
      listUnavailable: Effect.succeed([]),
      streamChanges: Stream.fromPubSub(changes),
      subscribeChanges: PubSub.subscribe(changes),
    });
  }),
);

describe("withDv3ProviderInstancePolicy", () => {
  it.effect("hides instances of disallowed drivers", () =>
    Effect.gen(function* () {
      const registry = yield* ProviderInstanceRegistry;

      assert.isUndefined(yield* registry.getInstance(id("codex")));
      assert.isDefined(yield* registry.getInstance(id("claudeAgent")));
      assert.deepStrictEqual(
        (yield* registry.listInstances).map((instance) => instance.instanceId),
        ["claudeAgent"],
      );
    }).pipe(Effect.provide(withDv3ProviderInstancePolicy(fakeRegistryLayer))),
  );
});

const registryAgent = (agentId: string) =>
  ({ id: agentId, name: agentId, description: `${agentId} agent` }) as AcpRegistrySearchAgent;

const fakeCatalogLayer = Layer.succeed(
  AcpRegistryCatalog,
  AcpRegistryCatalog.of({
    // Mimics the upstream cap: any query only ever returns this fixed page.
    search: () =>
      Effect.succeed({
        agents: ["gemini", "claude-acp", "junie", "github-copilot-cli"].map(registryAgent),
      }),
    prepare: (input) => Effect.succeed({ agentId: input.agentId } as AcpRegistryPrepareResult),
    inspect: () => Effect.die("unused"),
    resolve: () => Effect.die("unused"),
    uninstallManagedBinary: () => Effect.die("unused"),
  }),
);

describe("withDv3AcpRegistryPolicy", () => {
  it.effect("lists only allowed agents and filters them by the query", () =>
    Effect.gen(function* () {
      const catalog = yield* AcpRegistryCatalog;

      const all = yield* catalog.search({ query: "" });
      assert.deepStrictEqual(
        all.agents.map((agent) => agent.id),
        ["claude-acp", "junie", "github-copilot-cli"],
      );
      const junie = yield* catalog.search({ query: "jun" });
      assert.deepStrictEqual(
        junie.agents.map((agent) => agent.id),
        ["junie"],
      );
    }).pipe(Effect.provide(withDv3AcpRegistryPolicy(fakeCatalogLayer))),
  );

  it.effect("refuses to install a disallowed agent", () =>
    Effect.gen(function* () {
      const catalog = yield* AcpRegistryCatalog;

      assert.strictEqual((yield* catalog.prepare({ agentId: "junie" })).agentId, "junie");
      const error = yield* catalog.prepare({ agentId: "gemini" }).pipe(Effect.flip);
      assert.instanceOf(error, AcpRegistryError);
    }).pipe(Effect.provide(withDv3AcpRegistryPolicy(fakeCatalogLayer))),
  );
});
