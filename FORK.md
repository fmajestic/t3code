# T3 Code (Majestic)

A personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). The `fork` branch is `upstream/main` with a few commits rebased on top. Mostly they pull in fixes and features before upstream merges them, plus a few changes that only make sense for this fork.

## Ahead of upstream

Each of these is meant to be dropped once upstream has it, through its own PR or an equivalent fix.

### From upstream PRs

- **Cited quotes reach the agent readable**: quotes in a message are sent as quoted text with their comments, not as raw `t3-citation` links. From [#16389](https://github.com/pingdotgg/t3code/pull/16389).

### Not in an upstream PR

- **Option characters in the terminal**: on macOS, Option types the character the keyboard layout puts on it, such as `@` with Option+L on a German keyboard, instead of sending an Alt sequence. Settings > General > Option as Alt in terminal makes the chosen Option keys act as Alt again, for shell shortcuts like Option+B. From [#19833](https://github.com/pingdotgg/t3code/pull/19833), closed in triage while [#13046](https://github.com/pingdotgg/t3code/issues/13046) stays open.
- **"Continue with \<model\>" after a usage limit**: picking another model in the composer while a thread is stopped on a usage limit labels the resume button "Continue with \<model\>". Upstream merged resuming on the picked model in [#17867](https://github.com/pingdotgg/t3code/pull/17867) and closed [#16889](https://github.com/pingdotgg/t3code/pull/16889), which also had this label.
- **Quit shortcut off**: Settings > General > Quit shortcut has an Off mode, so Ctrl+Q (Cmd+Q on macOS) reaches the terminal instead of quitting. The menu's Quit item still works.
- **Quote user messages**: select text in a user message and choose Cite in composer, as with assistant responses.
- **Cmd+F searches the open file**: with focus in the file editor in the right panel, Cmd+F (Ctrl+F) opens the editor's search instead of the thread search.
- **Thread details card never narrows the chat**: the thread details card docks beside the chat whenever the chat, at its Settings > Appearance Chat width, fits to the left of it, shifting the chat off center if needed. Otherwise the card opens as a popover, which Full width always gets.
- **`@` completes paths outside the project**: an `@` path starting with `~/`, `/`, `./`, `../` or a drive letter lists one folder at a time on the server, instead of searching the project. Proposed in [discussion #17399](https://github.com/pingdotgg/t3code/discussions/17399).
- **Tab completes folders when adding a project**: in the add-project folder browser, Tab enters the highlighted or only matching folder, or extends what you typed to the folders' common prefix. `..` only shows before you type a filter.
- **Compaction shows tokens and time**: while compacting, the thread reads "Compacting 436K tokens for 12s", and the finished line adds how long it took, as in "Context compacted 436K → 19.3K tokens in 16s". Claude's auto-compaction shows no token count until it finishes.
- **Context growth per turn**: each finished turn shows how much it grew the context window, after "Worked for" or beside the response's copy button, as in "+43.7K context", or "context reset to 48K" when it shrank. A turn shows nothing when the turn before it reported no usage, or when the provider doesn't report usage at all, as with Cursor, Grok and Antigravity.
- **Rewind threads without a project**: each new thread without a project starts in a fresh Git repository, so its turns are checkpointed, show their diffs, and can be rewound, files included. When any thread's folder becomes a Git repository partway through, by `git init` or Initialize Git, every message you send after that can be rewound. Messages from before the init cannot.
- **Project picker says what it searches**: the project picker from Cmd+Shift+O (Ctrl+Shift+O) reads "Search projects...", says "No matching projects." when nothing matches, and Cmd+K (Ctrl+K) there searches everything for what you typed.
- **Desktop build tests inside Electron**: the Windows native probe tests pass when the suite runs from an agent inside the desktop app.

## Fork only

- **Name**: local desktop builds are called "T3 Code (Majestic)", so the bundle installs next to the official app instead of replacing it.
- **Windows builds from Actions**: every push to `fork` builds an unsigned Windows x64 installer on GitHub's own runners and replaces it on the fork's [fork-windows release](https://github.com/fmajestic/t3code/releases/tag/fork-windows). The installed app finds newer builds by itself, so Check for updates works like any other build; the installer is the fallback. `.github/workflows/fork-windows-build.yml` has the details.
- **Header artwork**: choose the Beta build's header artwork under Settings > Appearance. The Dock icon follows your choice. Windows has no such setting, so its desktop, Start menu, and taskbar icons bake in the same Ridge badge.
- **Local updates**: a local macOS build updates from the checkout it was built from. Check for updates installs a newer app bundle from its release folder, or offers to build the checkout when it has moved to another commit; the build log is `release/fork-build.log`. `vp run fork:dist:desktop:app` builds from the terminal: only the `.app`, no DMG or zip, stamped with a version the update check can tell apart, replacing the bundles of earlier builds.
- **Install without mobile**: `vp run i:desktop` installs only what desktop, web, the server and the repo scripts need. Worktree setup uses it too.
- **Regional date formats**: on macOS, dates and times use the order, separators and clock of the system region, while month and weekday names stay in the UI language.

## Syncing

Rebase `fork` onto `upstream/main`. Drop any commit from Ahead of upstream that upstream now covers.

A closed PR may have been superseded rather than abandoned: its closing comment usually names the replacement, which can cover only part of the commit, so keep what it leaves out and link the replacement.

If the closing comment names no replacement, read the comments on the issue the PR was fixing. GitHub only lists a PR on the issue when the PR says "Closes #<issue>", and some contributors link their PR in an issue comment instead.

When an entry gets an upstream PR, move it to From upstream PRs.

After rebasing, run `vp run i:desktop`: upstream often changes dependencies, and builds, including the one behind the update button, fail until they are installed.

Install never downloads the Chromium that web browser tests run in. When a sync bumps `playwright` in `apps/web/package.json`, run `node apps/web/node_modules/playwright/cli.js install --only-shell chromium`, as CI does.
