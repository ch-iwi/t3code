// fork(ch-iwi): keeps the Usage page to providers the DV³ allowlist permits.
//
// UsageService reads every built-in driver's history, including a default
// instance nobody configured, and Cursor's reader calls Cursor's API with a
// saved login. server.ts provides `Dv3UsagePolicyLive` so blocked drivers'
// transcripts and accounts are never read. The default allows every driver,
// which keeps upstream's UsageService tests unchanged.
import { isProviderDriverAllowed } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

/** Whether UsageService reads a driver's usage history. */
export const Dv3UsageDriverAllowed = Context.Reference<(driverKind: string) => boolean>(
  "@t3tools/server/dv3UsagePolicy/Dv3UsageDriverAllowed",
  { defaultValue: () => () => true },
);

export const Dv3UsagePolicyLive = Layer.succeed(Dv3UsageDriverAllowed, isProviderDriverAllowed);
