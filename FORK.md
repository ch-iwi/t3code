# Fork maintenance

This repository (`ch-iwi/t3code`) is a fork of [`pingdotgg/t3code`](https://github.com/pingdotgg/t3code).
We customize it while pulling upstream updates regularly, so every change should keep upstream merges cheap.

## Syncing with upstream

One-time setup per clone:

```bash
git remote add upstream https://github.com/pingdotgg/t3code.git
git config remote.upstream.fetch '+refs/heads/main:refs/remotes/upstream/main'
git config rerere.enabled true
```

Sync by merging on the command line, not rebasing and not with GitHub's "Sync fork" button. Rebasing a published branch forces a force-push on every sync and breaks worktrees. "Sync fork" runs no checks, cannot use `rerere`, and on a conflict offers to discard our commits, which would drop every DV³ customization from `main`.

Run each step from the main checkout:

1. Start from an up-to-date `main`:

   ```bash
   git checkout main && git pull --ff-only
   ```

2. Merge upstream. Resolve any conflicts against the customizations listed below; `rerere` replays resolutions it has seen before.

   ```bash
   git fetch upstream && git merge upstream/main
   ```

3. Reinstall dependencies and run the fork's own tests:

   ```bash
   vp i && vp test run apps/server/src/dv3ProviderPolicy.test.ts apps/server/src/dv3Telemetry.test.ts apps/server/src/dv3ConnectPolicy.test.ts apps/desktop/src/ssh apps/web/src/components/settings apps/web/src/components/onboarding apps/desktop/src/app scripts/build-desktop-artifact.test.ts scripts/lib/dv3-t3-connect.test.ts scripts/lib/dv3-build-version.test.ts
   ```

4. Check whether upstream added or moved anything a customization depends on. `git grep "fork(ch-iwi)"` and `git grep "DV³"` list every customized spot; the sections below say what each one must still do.
5. If the desktop app ships from this sync, build it once (`vp run dist:desktop:dmg:arm64`) and launch it.
6. Push:

   ```bash
   git push origin main
   ```

## Writing merge-friendly changes

1. **New files over edits.** Put fork logic in new modules. Upstream files get the smallest possible hook: a one-line import, registration, or call. Upstream never touches our new files, so they never conflict.
2. **Small, additive edits.** When an upstream file must change, append to lists, unions, and switch cases instead of inserting mid-block. Never reorder, rename, or move upstream code or files.
3. **No reformatting.** Run the repo's formatter so whitespace matches upstream. Don't format-on-save files you only read.
4. **Options over changed defaults.** A new setting in its own place survives upstream refactors; an edited default in a busy file conflicts often.
5. **Lockfile.** On a `pnpm-lock.yaml` conflict, take upstream's version and regenerate with `vp i`. Never hand-merge it.
6. **Mark edits to upstream files** with `// fork(ch-iwi): <reason>`. After a sync, `git grep "fork(ch-iwi)"` lists every spot to re-check.
7. **Upstream generic fixes.** A fix upstream accepts disappears from our diff. Their [CONTRIBUTING.md](CONTRIBUTING.md) accepts very small, focused fixes for obvious bugs without prior discussion; features need maintainer approval first, so keep those in the fork.

## Hotspots

Upstream changes these constantly. Avoid editing them, or keep edits to a single hook line:

- `packages/contracts` schemas
- `apps/server/src/orchestration-v2/`
- provider adapters
- `AGENTS.md` (put fork-specific agent instructions in this file instead)

## Fork customizations

The note at the top of `README.md` summarizes these for users. Update it when a customization is added, removed, or changes what users see.

- **Display name "DV³ Code".** Only the places that show the app's name: window and tab titles, the macOS menu and About panel, the Linux desktop entry, the sidebar and setup-wizard lockups, sign-in screens, the assistant message author, and mobile in-app headers. `git grep "DV³"` lists every spot. Prose such as "Restart T3 Code…" stays as upstream wrote it. The desktop bundle is renamed too (`productName` in `apps/desktop/package.json`, which sets the macOS menu-bar and Applications name), and installer files are named `DV3-Code-<version>-<arch>.<ext>` (`artifactName` in `scripts/build-desktop-artifact.ts`; ASCII on purpose). Upstream's AUR packaging under `packaging/aur` still expects `T3-Code-*` and is not used by this fork. The mobile home-screen name (Expo `name`, which also names the native `ios/` project) is deliberately left unchanged. Upstream adding a new brand spot is the main thing to look for after a sync. Electron puts the app name in its User-Agent, and the desktop proxy rejects non-Latin-1 header values, so `ElectronApp.setName` reduces the User-Agent to ASCII (`DV3 Code`); without that the desktop app hangs on the splash screen.
- **DV³ icons.** `node scripts/export-dv3-icons.ts` renders `assets/dv3/logo.png` into `assets/dv3/` for each channel: production on `#031E2F`, nightly and development on upstream's night-sky and blueprint backgrounds (read from `assets/<channel>/app-icon.icon/Assets/background.svg`). Pointed at them: desktop packaging (`resolveDesktopBuildIconAssets` in `scripts/build-desktop-artifact.ts`), web favicons (`WEB_ICON_SOURCE_PATHS_BY_BRAND` in `scripts/lib/brand-assets.ts`, which also feeds the `apps/web/public` copies), the unpackaged desktop icon (`DesktopAssets.ts`), and the dev launcher (`electron-launcher.mjs`). `BRAND_ASSET_PATHS` and upstream's Icon Composer projects are untouched, so `vp run icons:export` cannot overwrite the DV³ icons. The macOS installer backgrounds (`apps/desktop/resources/dmg/dmg-background-*.svg`) embed a 64px DV³ tile and say "Drag DV³ Code into Applications."; re-embed the tile if the icon changes. Mobile icons are still upstream's.
- **Separate state from T3 Code.** The desktop app keeps its data in `~/.dv3` instead of `~/.t3` (`DesktopStatePaths.ts`), its Electron profile in `dv3code` instead of `t3code-v2` (`DesktopUserData.ts`), and uses the app ID `ch.dvbern.dv3code` (`DESKTOP_APP_ID` in `scripts/build-desktop-artifact.ts`, `appUserModelId` in `DesktopEnvironment.ts`), so it can be installed next to T3 Code. The `t3code://` URL scheme is shared on purpose: the server, mobile app, and T3 Connect sign-in all expect it. The `t3` CLI is upstream's and still defaults to `~/.t3`.
- **Provider allowlist (compliance).** Only the Claude provider and the ACP Registry agents `claude-acp`, `junie`, and `github-copilot-cli` may run. The lists live in `packages/contracts/src/dv3ProviderAllowlist.ts`. `apps/server/src/dv3ProviderPolicy.ts` enforces them by wrapping three services where `server.ts` builds them (settings, the provider instance registry, the ACP Registry catalog), so upstream code and tests stay untouched; the "Add provider" dialog and the setup wizard's agent list (`PRIMARY_AGENT_DRIVERS` in `WelcomeWizard.tsx`) hide the rest, and Settings → Providers shows a blocked driver's slot only when the connected server reports it (`visibleProviderSettings` in `ProviderSettingsPanel.tsx`, so stock T3 Code servers stay manageable). The policy only binds DV³ servers: a DV³ client connected to a stock T3 Code server is not restricted. Blocked drivers are also never constructed: `BUILT_IN_DRIVERS` in `apps/server/src/provider/builtInDrivers.ts` is filtered through the allowlist, and `server.ts` swaps the Codex installation service for `Dv3CodexInstallationDisabledLive`, so nothing looks for or runs the Codex CLI. Six upstream tests that need the Codex driver or the full driver set are skipped with a `fork(ch-iwi)` note. After a sync, check that `server.ts` still builds those three layers through the wrappers and still uses the Codex stub, and skip any new upstream test that needs a blocked driver.
- **T3 Connect is off.** DV³ Code has no relay of its own, and T3 Connect would otherwise sign users in to T3's hosted Clerk and route environment links and agent activity through T3's relay. Every surface already hides Connect when the build carries no Clerk key or relay URL, so the fork only has to keep those values out: `vp run dist:desktop:*` fails when `T3CODE_RELAY_URL` or a `T3CODE_CLERK_*` Connect value is set (`scripts/lib/dv3-t3-connect.ts`, called at the start of `buildDesktopArtifact`). Don't follow upstream's `cp .env.example .env`. The server also refuses the Connect paths a client could still call, because the routes and RPCs are always mounted: `apps/server/src/dv3ConnectPolicy.ts` wraps CloudLink (no link proof or relay config, so no relay link is ever stored) and the relay client (no cloudflared download) where `server.ts` builds them, unless `hasCloudPublicConfig` is true. The ChatGPT sign-in handoff RPC belongs to Codex and bypasses the provider registry, so `ws.ts` refuses it while Codex is blocked. To turn Connect on, deploy `infra/relay` with our own Clerk instance and remove the check. After a sync, check that new Connect UI or server paths still stay hidden without that config (`git grep hasCloudPublicConfig`).
- **No SSH environment setup.** Upstream's SSH setup has the remote host download the `t3` release archive for the app's version from `pingdotgg/t3code`, which would run upstream T3 Code there without the allowlist. The fork publishes no such archives, so `apps/desktop/src/ssh/dv3SshPolicy.ts` (wrapped in `main.ts`) refuses `ensureEnvironment` and the Add Environment dialog drops its SSH card (`ConnectionsSettings.tsx`). Pairing a server started on the host by link still works. After a sync, check for new callers that launch remote servers (`git grep cliReleaseDownloadBaseUrl`).
- **No usage data by default.** Upstream sends product usage events to T3's PostHog unless `T3CODE_TELEMETRY_ENABLED=false`. The fork flips that default to `false` in `apps/server/src/telemetry/AnalyticsService.ts`, so nothing is sent unless a user sets it to `true`. `apps/server/src/dv3Telemetry.test.ts` guards the default. The onboarding notice about collected usage data is removed (`WelcomeWizard.tsx`) and the Settings → About privacy row says DV³ Code sends none. The server is the only telemetry sender; OTLP export has no default endpoint. After a sync, check that the default is still `false` and that upstream hasn't added another analytics sender or usage-data notice (`git grep -i "posthog\|usage data"`).
- **Own version number.** The desktop app is versioned from `dv3-version.json` (major.minor.patch), not from upstream's `apps/server/package.json`. Bump it with `node scripts/dv3-version.ts major|minor|patch` and commit the change. Builds are prereleases of that version, `<version>-dv3.<YYYYMMDD>.<commits on HEAD>`, with the date and count taken from HEAD so a commit gets the same version locally and on CI. Release builds (`DV3_RELEASE=true`, or the workflow's `release` input) use the plain version. `resolveDv3BuildVersion` (`scripts/lib/dv3-build-version.ts`) is hooked into `buildDesktopArtifact`; `--build-version` still overrides it. Only the Electron app and installer carry this version: the server and web client keep upstream's, which their version-skew check and the `t3` CLI compare. Settings → About on desktop shows the DV³ version, read from the desktop update state, with upstream's as "based on T3 Code …" (`Dv3AboutVersion.tsx`); browsers without the desktop bridge show upstream's only. Counting commits needs full history, so the CI workflow fetches without `--depth`, and a shallow clone fails the build. Keep the `-dv3.` identifier: upstream gives `-nightly.` and `-preview.` versions their own update channel and icons.
- **Installers from CI.** `.github/workflows/dv3-desktop-build.yml` (run it from the Actions tab) builds unsigned macOS arm64, Linux x64, and Windows x64 installers on GitHub-hosted runners and attaches them to the run. It adds to local builds, not replaces them: Mac builds still run locally with `vp run dist:desktop:dmg:arm64`, while Linux and Windows need the workflow because the build script requires a Linux host and the Windows MSVC toolchain. Upstream's `release.yml` is not usable here: it needs Blacksmith runners, upstream's signing secrets, and T3 Connect config. The Windows build has no embedded WSL runtime, so only its native backend works.

## Checking drift

```bash
git diff upstream/main...main --stat
```

If the same upstream file keeps appearing, move more of that change into fork-owned files.
