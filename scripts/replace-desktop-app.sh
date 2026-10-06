#!/usr/bin/env bash
# Fork-local: build the arm64 desktop app and swap it into ~/Applications.
set -euo pipefail

app_name="T3 Code (Majestic).app"
target="$HOME/Applications/$app_name"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"

cd "$repo_root"
if [[ "${1:-}" != "--skip-build" ]]; then
  # Stamp the next patch as a prerelease, like nightly CI does: provider compatibility
  # policies in model-manifest.json are keyed on the T3 Code version baked into the build.
  base_version="$(node -p 'require("./apps/server/package.json").version')"
  IFS=. read -r major minor patch <<<"$base_version"
  # Shaped like nightly's <date>.<run>; 10# drops the leading zero semver forbids in 0930.
  build_version="$major.$minor.$((patch + 1))-fork.$(date +%Y%m%d).$((10#$(date +%H%M)))"
  trap 'node scripts/update-release-package-versions.ts "$base_version" >/dev/null' EXIT
  node scripts/update-release-package-versions.ts "$build_version"
  node scripts/build-desktop-artifact.ts --platform mac --target dmg --arch arm64 --build-version "$build_version"
fi

zip="$(ls -t release/T3-Code-*-arm64.zip | head -1)"
# Match at line start: the matcher's own argv contains the path too, just not first.
if ps -axo command= | awk -v exe="$target/Contents/MacOS/" 'index($0, exe) == 1 { found = 1 } END { exit !found }'; then
  echo "$app_name is running; quit it and rerun with --skip-build." >&2
  exit 1
fi

echo "Installing $zip"
# ditto merges into an existing bundle, so stale files would survive and break the ad-hoc signature.
rm -rf "$target"
ditto -x -k "$zip" "$HOME/Applications/"
# A bundle replaced in place keeps its old cached icon until LaunchServices sees it change.
touch "$target"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$target"
echo "Installed $target"
