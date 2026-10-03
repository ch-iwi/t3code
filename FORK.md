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

## Checking drift

```bash
git diff upstream/main...main --stat
```

If the same upstream file keeps appearing, move more of that change into fork-owned files.
