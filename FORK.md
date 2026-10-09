# T3 Code (Majestic)

A personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). The `fork` branch is `upstream/main` with a few commits rebased on top. Mostly they pull in fixes and features before upstream merges them, plus a few changes that only make sense for this fork.

## Ahead of upstream

Each of these is meant to be dropped once upstream has it, through its own PR or an equivalent fix.

- **Option characters in the terminal**: macOS layouts that type characters such as `@`, `~` or `^` with Option now send those characters to the terminal, not an Alt sequence. From [#14735](https://github.com/pingdotgg/t3code/pull/14735).
- **Continue a rate-limited thread with a new model**: after a usage limit, pick another model in the composer and press Resume to continue on that model. From [#16889](https://github.com/pingdotgg/t3code/pull/16889).
- **Cited quotes reach the agent readable**: quotes in a message are sent as quoted text with their comments, not as raw `t3-citation` links. From [#16389](https://github.com/pingdotgg/t3code/pull/16389).
- **Quit shortcut off**: Settings > General > Quit shortcut has an Off mode, so Ctrl+Q (Cmd+Q on macOS) reaches the terminal instead of quitting. The menu's Quit item still works. No upstream PR yet.
- **Compact before sending is opt-in**: idle Claude threads no longer turn the send button into Compact and send unless Settings > General > Compact idle threads before sending is on, which also sets the idle minutes and token thresholds. No upstream PR yet.
- **Quote user messages**: select text in a user message and choose Cite in composer, as with assistant responses. No upstream PR yet.
- **Desktop build tests inside Electron**: the Windows native probe tests pass when the suite runs from an agent inside the desktop app. No upstream PR yet.

## Fork only

- **Name**: local desktop builds are called "T3 Code (Majestic)", so the bundle installs next to the official app instead of replacing it.
- **Windows builds from Actions**: every push to `fork` builds an unsigned Windows x64 installer on GitHub's own runners and replaces it on the fork's [fork-windows release](https://github.com/fmajestic/t3code/releases/tag/fork-windows). The installed app finds newer builds by itself, so Check for updates works like any other build; the installer is the fallback. `.github/workflows/fork-windows-build.yml` has the details.
- **Header artwork**: choose the Alpha build's header artwork under Settings > Appearance. The Dock icon follows your choice.
- **Local updates**: a local macOS build updates from the checkout it was built from. Check for updates installs a newer app bundle from its release folder, or offers to build the checkout when it has moved to another commit; the build log is `release/fork-build.log`. `vp run fork:dist:desktop:app` builds from the terminal: only the `.app`, no DMG or zip, stamped with a version the update check can tell apart, replacing the bundles of earlier builds.
- **Install without mobile**: `vp run i:desktop` installs only what desktop, web, the server and the repo scripts need. Worktree setup uses it too.
- **Regional date formats**: on macOS, dates and times use the order, separators and clock of the system region, while month and weekday names stay in the UI language.

## Syncing

Rebase `fork` onto `upstream/main`. Drop any commit from Ahead of upstream that upstream now covers. Then run `vp run i:desktop`: upstream often changes dependencies, and builds, including the one behind the update button, fail until they are installed.
