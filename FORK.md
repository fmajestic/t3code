# T3 Code (Majestic)

A personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). The `fork` branch is `upstream/main` with a few commits rebased on top. Mostly they pull in fixes and features before upstream merges them, plus a few changes that only make sense for this fork.

## Ahead of upstream

Each of these is meant to be dropped once upstream has it, through its own PR or an equivalent fix.

- **Option characters in the terminal**: on macOS, Option types the character the keyboard layout puts on it, such as `@` with Option+L on a German keyboard, instead of sending an Alt sequence. Settings > General > Option as Alt in terminal makes the chosen Option keys act as Alt again, for shell shortcuts like Option+B. From [#19833](https://github.com/pingdotgg/t3code/pull/19833).
- **Continue a rate-limited thread with a new model**: after a usage limit, pick another model in the composer and press Resume to continue on that model. From [#16889](https://github.com/pingdotgg/t3code/pull/16889).
- **Quit shortcut off**: Settings > General > Quit shortcut has an Off mode, so Ctrl+Q (Cmd+Q on macOS) reaches the terminal instead of quitting. The menu's Quit item still works. No upstream PR yet.
- **Desktop build tests inside Electron**: the Windows native probe tests pass when the suite runs from an agent inside the desktop app. No upstream PR yet.

## Fork only

- **Name**: local desktop builds are called "T3 Code (Majestic)", so the bundle installs next to the official app instead of replacing it.
- **Header artwork**: choose the Beta build's header artwork under Settings > Appearance. The Dock icon follows your choice. Windows has no such setting, so its desktop, Start menu, and taskbar icons bake in the same Ridge badge.
- **Local updates**: a local macOS build updates from the checkout it was built from. Check for updates installs a newer app bundle from its release folder, or offers to build the checkout when it has moved to another commit; the build log is `release/fork-build.log`. `vp run fork:dist:desktop:app` builds from the terminal: only the `.app`, no DMG or zip, stamped with a version the update check can tell apart, replacing the bundles of earlier builds.
- **Install without mobile**: `vp run i:desktop` installs only what desktop, web, the server and the repo scripts need. Worktree setup uses it too.
- **Regional date formats**: on macOS, dates and times use the order, separators and clock of the system region, while month and weekday names stay in the UI language.

## Syncing

Rebase `fork` onto `upstream/main`. Drop any commit from Ahead of upstream that upstream now covers.
