// fork(ch-iwi): the Usage page reads only providers the DV³ allowlist permits. Cursor's reader
// would otherwise call Cursor's API with a saved login. server.ts provides `Dv3UsagePolicyLive`;
// the default allows every driver so upstream's UsageService tests stay unchanged.
import { isProviderDriverAllowed } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

/** Whether UsageService reads a driver's usage history. */
export const Dv3UsageDriverAllowed = Context.Reference<(driverKind: string) => boolean>(
  "@t3tools/server/dv3UsagePolicy/Dv3UsageDriverAllowed",
  { defaultValue: () => () => true },
);

export const Dv3UsagePolicyLive = Layer.succeed(Dv3UsageDriverAllowed, isProviderDriverAllowed);
