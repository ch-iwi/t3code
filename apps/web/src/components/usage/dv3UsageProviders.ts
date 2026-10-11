// fork(ch-iwi): the Usage filter menu hides providers the DV³ allowlist blocks.
import { isProviderDriverAllowed, type UsageProviderKind } from "@t3tools/contracts";

import { PROVIDER_ORDER, PROVIDER_PRESENTATION } from "./usageProviders";

/**
 * Providers the filter menu offers: the allowed ones, plus any blocked one an
 * environment still reports usage for, such as a stock T3 Code server. Hidden
 * providers report no usage, so they stay listed to be shown again.
 */
export function dv3FilterMenuProviders(
  providersWithData: readonly UsageProviderKind[],
  hiddenProviders: ReadonlySet<UsageProviderKind>,
): readonly UsageProviderKind[] {
  return PROVIDER_ORDER.filter(
    (provider) =>
      isProviderDriverAllowed(PROVIDER_PRESENTATION[provider].driverKind) ||
      providersWithData.includes(provider) ||
      hiddenProviders.has(provider),
  );
}
