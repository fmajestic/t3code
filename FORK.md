# T3 Code (Majestic)

A personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). The `fork` branch is `upstream/main` with a few commits rebased on top. Mostly they pull in fixes and features before upstream merges them, plus a few changes that only make sense for this fork.

## Picked early from upstream

Each of these is meant to be dropped once its upstream PR merges.

- **Option characters in the terminal**: on macOS, Option types the character the keyboard layout puts on it, such as `@` with Option+L on a German keyboard, instead of sending an Alt sequence. Settings > General > Option as Alt in terminal makes the chosen Option keys act as Alt again, for shell shortcuts like Option+B. From [#19833](https://github.com/pingdotgg/t3code/pull/19833).
- **Continue a rate-limited thread with a new model**: after a usage limit, pick another model in the composer and press Resume to continue on that model. From [#16889](https://github.com/pingdotgg/t3code/pull/16889).

## Fork only

- **Name**: local desktop builds are called "T3 Code (Majestic)", so the bundle installs next to the official app instead of replacing it.
- **Header artwork**: choose the Alpha build's header artwork under Settings > Appearance. The Dock icon follows your choice.
- **Local updates**: a local macOS build checks the release folder it was built into for updates. `dev:replace-app` rebuilds the arm64 app and reinstalls it in `~/Applications`.
- **Install without mobile**: `vp run i:desktop` installs only what desktop, web, the server and the repo scripts need. Worktree setup uses it too.

## Syncing

Rebase `fork` onto `upstream/main`. Drop any picked commit whose PR has merged upstream.
