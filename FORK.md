# T3 Code (Majestic)

A personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). The `fork` branch is `upstream/main` with a few commits rebased on top. Mostly they pull in fixes and features before upstream merges them, plus a few changes that only make sense for this fork.

## Ahead of upstream

Each of these is meant to be dropped once upstream has it, through its own PR or an equivalent fix.

- **Option characters in the terminal**: macOS layouts that type characters such as `@`, `~` or `^` with Option now send those characters to the terminal, not an Alt sequence. From [#14735](https://github.com/pingdotgg/t3code/pull/14735).
- **Continue a rate-limited thread with a new model**: after a usage limit, pick another model in the composer and press Resume to continue on that model. From [#16889](https://github.com/pingdotgg/t3code/pull/16889).
- **Quit shortcut off**: Settings > General > Quit shortcut has an Off mode, so Ctrl+Q (Cmd+Q on macOS) reaches the terminal instead of quitting. The menu's Quit item still works. No upstream PR yet.
- **Desktop build tests inside Electron**: the Windows native probe tests pass when the suite runs from an agent inside the desktop app. No upstream PR yet.

## Fork only

- **Name**: local desktop builds are called "T3 Code (Majestic)", so the bundle installs next to the official app instead of replacing it.
- **Header artwork**: choose the Alpha build's header artwork under Settings > Appearance. The Dock icon follows your choice.
- **Local updates**: a local macOS build checks the release folder it was built into for updates. `dev:replace-app` rebuilds the arm64 app and reinstalls it in `~/Applications`.
- **Install without mobile**: `vp run i:desktop` installs only what desktop, web, the server and the repo scripts need. Worktree setup uses it too.
- **Regional date formats**: on macOS, dates and times use the order, separators and clock of the system region, while month and weekday names stay in the UI language.

## Syncing

Rebase `fork` onto `upstream/main`. Drop any commit from Ahead of upstream that upstream now covers.
