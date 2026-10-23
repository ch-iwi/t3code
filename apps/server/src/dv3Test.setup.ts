// fork(ch-iwi): upstream's tests exercise the pinned runtime with fake releases, so they
// run with it allowed; dv3PinnedRuntimePolicy.test.ts unmocks this to check the real block.
import { vi } from "vite-plus/test";

vi.mock("./dv3PinnedRuntimePolicy.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./dv3PinnedRuntimePolicy.ts")>()),
  dv3PinnedRuntimeInstallsAllowed: true,
}));
