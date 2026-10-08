#!/usr/bin/env bash
# Prints the GitHub release notes for a DV³ Code desktop release as Markdown.
#
#   dv3-release-notes.sh <version> <upstream-ref> [build-run-url]
#
# Needs HEAD's full commit history, the dv3-v* tags, and upstream's main at
# <upstream-ref>. Changes are counted from the previous DV³ release: any
# dv3-v* tag for a prerelease, the previous full release for a full release.
set -euo pipefail

version=$1
upstream=$2
run_url=${3:-}
repo=${GITHUB_REPOSITORY:-ch-iwi/t3code}

t3_version() {
  git show "$1:apps/server/package.json" | sed -n 's/^  "version": "\(.*\)",$/\1/p'
}

describe_args=(--tags --abbrev=0 --match 'dv3-v*' --exclude "dv3-v$version")
if [[ $version != *-* ]]; then
  describe_args+=(--exclude 'dv3-v*-*')
fi
previous=$(git describe "${describe_args[@]}" HEAD 2>/dev/null || true)

head=$(git rev-parse HEAD)
built_from="Built from \`${head:0:10}\`"
if [[ -n $run_url ]]; then
  built_from+=" by the [DV³ desktop build]($run_url) workflow"
fi
echo "DV³ Code $version, based on T3 Code $(t3_version HEAD). $built_from."

if [[ -n $previous ]]; then
  echo
  echo "## DV³ changes"
  echo
  changes=$(git log --no-merges --format='- %s' "$previous..HEAD" --not "$upstream")
  if [[ -n $changes ]]; then
    echo "Since [$previous](https://github.com/$repo/compare/$previous...$head):"
    echo
    echo "$changes"
  else
    echo "No DV³ changes since $previous."
  fi

  echo
  echo "## T3 Code"
  echo
  old_base=$(git merge-base "$previous" "$upstream")
  new_base=$(git merge-base HEAD "$upstream")
  if [[ $old_base == "$new_base" ]]; then
    echo "No upstream changes since $previous."
  else
    count=$(git rev-list --no-merges --count "$old_base..$new_base")
    link="[$count upstream commits](https://github.com/pingdotgg/t3code/compare/$old_base...$new_base)"
    old_version=$(t3_version "$old_base")
    new_version=$(t3_version "$new_base")
    if [[ $old_version == "$new_version" ]]; then
      echo "Includes $link since $previous, still on T3 Code $new_version."
    else
      echo "Updated from T3 Code $old_version to $new_version: $link."
    fi
  fi
fi

cat <<EOF

## Install

| Platform | File |
|---|---|
| macOS (Apple Silicon) | \`DV3-Code-$version-arm64.dmg\` |
| Windows x64 | \`DV3-Code-$version-x64.exe\` |
| Linux x64 | \`DV3-Code-$version-x86_64.AppImage\` |

**These builds are not signed with a Developer ID.**
- macOS: the first launch is blocked because Apple can't verify the app. Click Done, then open System Settings → Privacy & Security and click Open Anyway next to DV³ Code. Older DV³ releases instead say the app is damaged; for those, run \`xattr -cr "/Applications/DV³ Code (Alpha).app"\`.
- Windows: SmartScreen warns before the installer runs. The WSL backend is not included; agents run natively on Windows.
- Linux: make the AppImage executable with \`chmod +x\` before running it.
EOF
