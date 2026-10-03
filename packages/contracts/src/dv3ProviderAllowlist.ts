// fork(ch-iwi): DV³ Code compliance allowlist for agent providers.
//
// The server enforces this (registered drivers, settings it serves, the ACP
// Registry catalog); clients use it only to hide options that would be refused.
// Change these lists here and nowhere else.
import type { ProviderInstanceConfig } from "./providerInstance.ts";

/** Provider drivers this build may run: Claude, and the ACP Registry (limited below). */
export const ALLOWED_PROVIDER_DRIVERS: ReadonlySet<string> = new Set([
  "claudeAgent",
  "acpRegistry",
]);

/** ACP Registry agent ids that may be listed, installed, or launched. */
export const ALLOWED_ACP_REGISTRY_AGENTS: ReadonlySet<string> = new Set([
  "claude-acp",
  "junie",
  "github-copilot-cli",
]);

export function isProviderDriverAllowed(driver: string): boolean {
  return ALLOWED_PROVIDER_DRIVERS.has(driver);
}

export function isAcpRegistryAgentAllowed(agentId: string): boolean {
  return ALLOWED_ACP_REGISTRY_AGENTS.has(agentId.trim());
}

/**
 * Whether a configured provider instance may exist. ACP Registry instances
 * also need an allowed agent; one without an agent id yet cannot launch anything.
 */
export function isProviderInstanceConfigAllowed(instance: ProviderInstanceConfig): boolean {
  if (!isProviderDriverAllowed(instance.driver)) return false;
  if (instance.driver !== "acpRegistry") return true;
  const agentId =
    typeof instance.config === "object" && instance.config !== null && "agentId" in instance.config
      ? instance.config.agentId
      : undefined;
  return typeof agentId !== "string" || agentId.trim() === "" || isAcpRegistryAgentAllowed(agentId);
}
