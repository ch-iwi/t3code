// fork(ch-iwi): enforces the DV³ Code provider allowlist (packages/contracts/src/dv3ProviderAllowlist.ts).
//
// Upstream services stay untouched; server.ts wraps three of them where it
// builds the runtime, so every consumer (web, desktop, mobile, MCP tools,
// scheduled tasks) sees the restricted view:
//   - settings: disallowed provider instances are dropped, disallowed built-in
//     providers read as disabled, and model selections fall back to Claude.
//     The settings file on disk keeps everything.
//   - provider instance registry: instances of disallowed drivers cannot be
//     looked up, so no session, turn, or text generation can run on them.
//   - ACP Registry catalog: only allowed agents can be searched, installed,
//     inspected, or launched.
import {
  ALLOWED_ACP_REGISTRY_AGENTS,
  DEFAULT_MODEL_BY_PROVIDER,
  DEFAULT_TEXT_GENERATION_MODEL_BY_PROVIDER,
  isAcpRegistryAgentAllowed,
  isProviderDriverAllowed,
  isProviderInstanceConfigAllowed,
  type AcpRegistrySearchAgent,
  type ModelSelection,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerSettings,
  ServerSettingsError,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { AcpRegistryCatalog, AcpRegistryError } from "./provider/acp/AcpRegistrySupport.ts";
import type { ProviderInstance } from "./provider/ProviderDriver.ts";
import { ProviderInstanceRegistry } from "./provider/Services/ProviderInstanceRegistry.ts";
import { ServerSettingsService } from "./serverSettings.ts";

const CLAUDE_DRIVER = ProviderDriverKind.make("claudeAgent");

const CLAUDE_TEXT_GENERATION_SELECTION: ModelSelection = {
  instanceId: ProviderInstanceId.make(CLAUDE_DRIVER),
  model:
    DEFAULT_TEXT_GENERATION_MODEL_BY_PROVIDER[CLAUDE_DRIVER] ??
    DEFAULT_MODEL_BY_PROVIDER[CLAUDE_DRIVER] ??
    "claude-haiku-4-5",
};

/** The restricted settings view every server consumer and client receives. */
export function applyDv3ProviderPolicy(settings: ServerSettings): ServerSettings {
  const providerInstances = Object.fromEntries(
    Object.entries(settings.providerInstances).filter(([, instance]) =>
      isProviderInstanceConfigAllowed(instance),
    ),
  ) as ServerSettings["providerInstances"];
  const providers = Object.fromEntries(
    Object.entries(settings.providers).map(([driver, provider]) => [
      driver,
      isProviderDriverAllowed(driver) ? provider : { ...provider, enabled: false },
    ]),
  ) as ServerSettings["providers"];
  // Explicit instances survived the filter above; otherwise the id is a
  // built-in driver's default instance, which is named after its driver.
  const isSelectionAllowed = (selection: ModelSelection) =>
    selection.instanceId in providerInstances || isProviderDriverAllowed(selection.instanceId);
  const keepIfAllowed = (selection: ModelSelection | null) =>
    selection !== null && isSelectionAllowed(selection) ? selection : null;

  return {
    ...settings,
    providers,
    providerInstances,
    textGenerationModelSelection: isSelectionAllowed(settings.textGenerationModelSelection)
      ? settings.textGenerationModelSelection
      : CLAUDE_TEXT_GENERATION_SELECTION,
    defaultModelSelection: keepIfAllowed(settings.defaultModelSelection),
    sourceControlWriterModelSelection: keepIfAllowed(settings.sourceControlWriterModelSelection),
  };
}

/** Wraps the live settings layer so everything it serves is policy-filtered. */
export const withDv3SettingsPolicy = <E, R>(
  layer: Layer.Layer<ServerSettingsService, E, R>,
): Layer.Layer<ServerSettingsService, E, R> =>
  Layer.effect(
    ServerSettingsService,
    Effect.gen(function* () {
      const inner = yield* ServerSettingsService;
      return ServerSettingsService.of({
        ...inner,
        getSettings: inner.getSettings.pipe(Effect.map(applyDv3ProviderPolicy)),
        updateSettings: (patch) =>
          inner.updateSettings(patch).pipe(Effect.map(applyDv3ProviderPolicy)),
        updateProviderInstance: (mutation, patch) =>
          mutation.operation !== "remove" && !isProviderInstanceConfigAllowed(mutation.instance)
            ? Effect.fail(
                new ServerSettingsError({
                  settingsPath: "the DV³ Code provider policy",
                  operation: "create-provider-instance",
                  providerInstanceId: mutation.instanceId,
                  cause: new Error(`${mutation.instance.driver} is not allowed in DV³ Code.`),
                }),
              )
            : inner
                .updateProviderInstance(mutation, patch)
                .pipe(Effect.map(applyDv3ProviderPolicy)),
        withSettingsSnapshot: (use) =>
          inner.withSettingsSnapshot((settings) => use(applyDv3ProviderPolicy(settings))),
        streamChanges: inner.streamChanges.pipe(Stream.map(applyDv3ProviderPolicy)),
        subscribeChanges: inner.subscribeChanges.pipe(
          Effect.map(Stream.map(applyDv3ProviderPolicy)),
        ),
      });
    }),
  ).pipe(Layer.provide(layer));

const isInstanceAllowed = (instance: ProviderInstance) =>
  isProviderDriverAllowed(instance.driverKind);

/** Wraps the provider instance registry so disallowed drivers cannot be resolved. */
export const withDv3ProviderInstancePolicy = <E, R>(
  layer: Layer.Layer<ProviderInstanceRegistry, E, R>,
): Layer.Layer<ProviderInstanceRegistry, E, R> =>
  Layer.effect(
    ProviderInstanceRegistry,
    Effect.gen(function* () {
      const inner = yield* ProviderInstanceRegistry;
      return ProviderInstanceRegistry.of({
        ...inner,
        getInstance: (instanceId) =>
          inner
            .getInstance(instanceId)
            .pipe(
              Effect.map((instance) =>
                instance !== undefined && isInstanceAllowed(instance) ? instance : undefined,
              ),
            ),
        listInstances: inner.listInstances.pipe(
          Effect.map((instances) => instances.filter(isInstanceAllowed)),
        ),
        listUnavailable: inner.listUnavailable.pipe(
          Effect.map((providers) =>
            providers.filter((provider) => isProviderDriverAllowed(provider.driver)),
          ),
        ),
      });
    }),
  ).pipe(Layer.provide(layer));

const blockedAgentError = (agentId: string) =>
  new AcpRegistryError({
    reason: "agent_not_found",
    detail: `ACP Registry agent '${agentId.trim()}' is not allowed in DV³ Code.`,
  });

function matchesQuery(agent: AcpRegistrySearchAgent, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const haystack = `${agent.id} ${agent.name} ${agent.description}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * Wraps the ACP Registry catalog. Search looks up each allowed agent by id,
 * because the upstream search caps results and could rank them out.
 */
export const withDv3AcpRegistryPolicy = <A, E, R>(
  layer: Layer.Layer<A | AcpRegistryCatalog, E, R>,
): Layer.Layer<A | AcpRegistryCatalog, E, R> =>
  Layer.merge(
    layer,
    Layer.effect(
      AcpRegistryCatalog,
      Effect.gen(function* () {
        const inner = yield* AcpRegistryCatalog;
        return AcpRegistryCatalog.of({
          ...inner,
          search: (input) =>
            Effect.forEach(ALLOWED_ACP_REGISTRY_AGENTS, (agentId) =>
              inner
                .search({ query: agentId })
                .pipe(Effect.map((result) => result.agents.find((agent) => agent.id === agentId))),
            ).pipe(
              Effect.map((agents) => ({
                agents: agents.filter(
                  (agent): agent is AcpRegistrySearchAgent =>
                    agent !== undefined && matchesQuery(agent, input.query),
                ),
              })),
            ),
          prepare: (input) =>
            isAcpRegistryAgentAllowed(input.agentId)
              ? inner.prepare(input)
              : Effect.fail(blockedAgentError(input.agentId)),
          inspect: (settings, environment) =>
            isAcpRegistryAgentAllowed(settings.agentId)
              ? inner.inspect(settings, environment)
              : Effect.fail(blockedAgentError(settings.agentId)),
          resolve: (settings, cwd, environment) =>
            isAcpRegistryAgentAllowed(settings.agentId)
              ? inner.resolve(settings, cwd, environment)
              : Effect.fail(blockedAgentError(settings.agentId)),
        });
      }),
    ).pipe(Layer.provide(layer)),
  );
