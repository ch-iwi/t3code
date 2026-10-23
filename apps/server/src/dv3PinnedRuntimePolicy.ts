// fork(ch-iwi): DV³ Code publishes no `t3` release archives. Upstream's pinned runtime
// (`t3 update`, `t3 service install`, remote server updates) would download T3 Code's
// own release from pingdotgg/t3code, which runs without the DV³ provider allowlist.

/** Whether `ensurePinnedRuntimeInstalled` may install a `t3` release. */
export const dv3PinnedRuntimeInstallsAllowed: boolean = false;

/** The step named in the `PinnedRuntimeInstallError` users see. */
export const DV3_PINNED_RUNTIME_DISABLED_STEP = "installing a t3 release, which DV³ Code turns off";
