# Fork maintenance

This repository (`ch-iwi/t3code`) is a fork of [`pingdotgg/t3code`](https://github.com/pingdotgg/t3code).
We customize it while pulling upstream updates regularly, so every change should keep upstream merges cheap.

## Syncing with upstream

One-time setup per clone:

```bash
git remote add upstream https://github.com/pingdotgg/t3code.git
git config rerere.enabled true
```

Sync by merging, not rebasing. Rebasing a published branch forces a force-push on every sync and breaks worktrees.

```bash
git fetch upstream && git merge upstream/main
```

`rerere` records each conflict resolution and replays it when the same conflict reappears in a later sync.

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

- **Display name "DV³ Code".** Only the places that show the app's name: window and tab titles, the macOS menu and About panel, the Linux desktop entry, the sidebar and setup-wizard lockups, sign-in screens, the assistant message author, and mobile in-app headers. `git grep "DV³"` lists every spot. Prose such as "Restart T3 Code…" stays as upstream wrote it. The desktop bundle is renamed too (`productName` in `apps/desktop/package.json`, which sets the macOS menu-bar and Applications name), and installer files are named `DV3-Code-<version>-<arch>.<ext>` (`artifactName` in `scripts/build-desktop-artifact.ts`; ASCII on purpose). Upstream's AUR packaging under `packaging/aur` still expects `T3-Code-*` and is not used by this fork. The mobile home-screen name (Expo `name`, which also names the native `ios/` project) is deliberately left unchanged. Upstream adding a new brand spot is the main thing to look for after a sync. Electron puts the app name in its User-Agent, and the desktop proxy rejects non-Latin-1 header values, so `ElectronApp.setName` reduces the User-Agent to ASCII (`DV3 Code`); without that the desktop app hangs on the splash screen.
- **DV³ icons.** `node scripts/export-dv3-icons.ts` renders `assets/dv3/logo.png` into `assets/dv3/` for each channel: production on `#031E2F`, nightly and development on upstream's night-sky and blueprint backgrounds (read from `assets/<channel>/app-icon.icon/Assets/background.svg`). Pointed at them: desktop packaging (`resolveDesktopBuildIconAssets` in `scripts/build-desktop-artifact.ts`), web favicons (`WEB_ICON_SOURCE_PATHS_BY_BRAND` in `scripts/lib/brand-assets.ts`, which also feeds the `apps/web/public` copies), the unpackaged desktop icon (`DesktopAssets.ts`), and the dev launcher (`electron-launcher.mjs`). `BRAND_ASSET_PATHS` and upstream's Icon Composer projects are untouched, so `vp run icons:export` cannot overwrite the DV³ icons. The macOS installer backgrounds (`apps/desktop/resources/dmg/dmg-background-*.svg`) embed a 64px DV³ tile and say "Drag DV³ Code into Applications."; re-embed the tile if the icon changes. Mobile icons are still upstream's.
- **Separate state from T3 Code.** The desktop app keeps its data in `~/.dv3` instead of `~/.t3` (`DesktopStatePaths.ts`), its Electron profile in `dv3code` instead of `t3code-v2` (`DesktopUserData.ts`), and uses the app ID `ch.dvbern.dv3code` (`DESKTOP_APP_ID` in `scripts/build-desktop-artifact.ts`, `appUserModelId` in `DesktopEnvironment.ts`), so it can be installed next to T3 Code. The `t3code://` URL scheme is shared on purpose: the server, mobile app, and T3 Connect sign-in all expect it. The `t3` CLI is upstream's and still defaults to `~/.t3`.

## Checking drift

```bash
git diff upstream/main...main --stat
```

If the same upstream file keeps appearing, move more of that change into fork-owned files.
