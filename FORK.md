# T3 Code (Majestic)

A personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). The `fork` branch is `upstream/main` with a few commits rebased on top. Mostly they pull in fixes and features before upstream merges them, plus a few changes that only make sense for this fork.

## Picked early from upstream

Each of these is meant to be dropped once its upstream PR merges.

- **Option characters in the terminal**: macOS layouts that type characters such as `@`, `~` or `^` with Option now send those characters to the terminal, not an Alt sequence. From [#14735](https://github.com/pingdotgg/t3code/pull/14735).
- **Continue a rate-limited thread with a new model**: after a usage limit, pick another model in the composer and press Resume to continue on that model. From [#16889](https://github.com/pingdotgg/t3code/pull/16889).

## Fork only

- **Name**: local desktop builds are called "T3 Code (Majestic)", so the bundle installs next to the official app instead of replacing it.
- **Header artwork**: choose the Beta build's header artwork under Settings > Appearance. The Dock icon follows your choice. Windows has no such setting, so its desktop, Start menu, and taskbar icons bake in the same Ridge badge.
- **Local updates**: a local macOS build updates from the checkout it was built from. Check for updates installs a newer app bundle from its release folder, or offers to build the checkout when it has moved to another commit; the build log is `release/fork-build.log`. `vp run fork:dist:desktop:app` builds from the terminal: only the `.app`, no DMG or zip, stamped with a version the update check can tell apart, replacing the bundles of earlier builds.
- **Install without mobile**: `vp run i:desktop` installs only what desktop, web, the server and the repo scripts need. Worktree setup uses it too.

## Syncing

Rebase `fork` onto `upstream/main`. Drop any picked commit whose PR has merged upstream.
