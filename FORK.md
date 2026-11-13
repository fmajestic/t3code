# T3 Code (Majestic)

A personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). The `fork` branch is `upstream/main` with a few commits rebased on top. Mostly they pull in fixes and features before upstream merges them, plus a few changes that only make sense for this fork.

## Ahead of upstream

Each of these is meant to be dropped once upstream has it, through its own PR or an equivalent fix.

### From upstream PRs

None right now.

### Not in an upstream PR

- **Cmd+. in the terminal**: on macOS, Cmd+. sends Esc followed by a period, the shell's insert-last-argument, so it works while Option types characters. It mirrors Ghostty's `keybind = cmd+period=esc:.`.
- **"Continue with \<model\>" after a usage limit**: picking another model in the composer while a thread is stopped on a usage limit labels the resume button "Continue with \<model\>". Upstream merged resuming on the picked model in [#17867](https://github.com/pingdotgg/t3code/pull/17867) and closed [#16889](https://github.com/pingdotgg/t3code/pull/16889), which also had this label.
- **Quit shortcut off**: Settings > General > Quit shortcut has an Off mode, so Ctrl+Q (Cmd+Q on macOS) reaches the terminal instead of quitting. The menu's Quit item still works.
- **Quote user messages**: select text in a user message and choose Cite in composer, as with assistant responses.
- **Cmd+F searches the open file**: with focus in a file in the right panel, Cmd+F (Ctrl+F) searches that file instead of the thread: the editor opens its own search, rendered markdown opens a find bar, and a PDF focuses its Find in PDF box.
- **Line numbers in code blocks**: chat code blocks can number their lines. Settings > Appearance > Code line numbers sets the default, and each block's header toggles it, like word wrap. Copied code has no numbers.
- **`@` completes paths outside the project**: an `@` path starting with `~/`, `/`, `./`, `../` or a drive letter lists one folder at a time on the server, instead of searching the project. Proposed in [discussion #17399](https://github.com/pingdotgg/t3code/discussions/17399).
- **`..` hides while filtering when adding a project**: in the add-project folder browser, `..` only shows before you type a filter, so it never sits above the matching folders. Tab completion itself came upstream in [#28243](https://github.com/pingdotgg/t3code/pull/28243).
- **Compaction shows tokens and time**: while compacting, the thread reads "Compacting 436K tokens for 12s", and the finished line adds how long it took, as in "Context compacted 436K → 19.3K tokens in 16s". Claude's auto-compaction shows no token count until it finishes.
- **Context growth per turn**: each finished turn shows how much it grew the context window, after "Worked for" or beside the response's copy button, as in "+43.7K context", or "context reset to 48K" when it shrank. A turn shows nothing when the turn before it reported no usage, or when the provider doesn't report usage at all, as with Cursor, Grok and Antigravity.
- **Rewind threads without a project**: each new thread without a project starts in a fresh Git repository, so its turns are checkpointed, show their diffs, and can be rewound, files included. When any thread's folder becomes a Git repository partway through, by `git init` or Initialize Git, every message you send after that can be rewound. Messages from before the init rewind only the conversation, as upstream does in any folder without Git since [#18379](https://github.com/pingdotgg/t3code/pull/18379).
- **Project picker says what it searches**: the project picker from Cmd+Shift+O (Ctrl+Shift+O) reads "Search projects...", says "No matching projects." when nothing matches, and Cmd+K (Ctrl+K) there searches everything for what you typed.
- **Typing returns the terminal to the prompt**: typing or pasting in the integrated terminal while scrolled up in its history scrolls back down to the prompt, as Ghostty does. Upstream closed the same fix, [#8762](https://github.com/pingdotgg/t3code/pull/8762), in triage for lacking a recording of the behavior.
- **Hiding skills hides them from the slash menu**: with Settings > Chat > Show skills in slash menu off, skills no longer show up anyway as the slash commands the provider also reports them as, such as `/grill-me` from Claude.
- **Retired text generation model falls back**: when the provider stops offering the text generation model, thread titles, commit messages and other generated text use the same fallback Settings shows, instead of failing every time, as when OpenCode rotates its free models. The picker under Settings > Threads > Text generation marks the saved model Unavailable and names the fallback, and each provider check that finds it shows a toast.
- **Test notification**: Settings > General > Thread notifications has a Test button. Five seconds after you press it, it sends a system notification whatever the window focus, and then reports the permission and whether the window counted as focused.
- **Notification sounds right after launch**: in the desktop app, thread sounds play from the moment it starts, instead of only after your first click or key press, which only browsers need.
- **Dragged thread's slot fits it**: while dragging a thread in the sidebar, the gap it leaves keeps the thread's own height, so a taller or shorter card no longer overlaps or floats above its neighbours. The card stays where you grabbed it.
- **Compaction offered, not chosen**: Settings > Providers > Advanced > Compact idle threads has an "Offered when you return" mode. The Compact chip still shows when you return to an idle thread, but starts on Keep, so you click it only when you want to compact.
- **Settings opens in its search**: opening Settings puts the cursor in its search box, so you can start typing right away. Touch screens and narrow windows still open without focus, so no keyboard pops up.
- **Equal thread matches list newest first**: in Cmd+K (Ctrl+K), threads that match equally well and are both heavily used list by latest activity, then latest open, instead of in no particular order.
- **Ligatures survive typing in the composer**: with a ligature font such as Fira Code, typing after `...`, `->` or `!==` no longer leaves a gap and a stray glyph. Chromium 151–155 reshapes only around the edit ([573312311](https://issues.chromium.org/issues/573312311), fixed in 156); any non-zero `word-spacing` on the composer makes it reshape properly, so ligatures stay on. Drop it once upstream moves to Electron 45, the first on Chromium 156.
- **Context row under the composer is a rounded pill**: the workspace and branch row sits slightly inset from the composer with rounded corners, so the glass upstream gave it in [#34846](https://github.com/pingdotgg/t3code/pull/34846) reads as its own surface instead of a sharp rectangle under the card when the chat scrolls behind it.
- **Reset times name the weekday**: usage limit resets within the coming week read "Thursday at 7:00" instead of a bare date, and later ones put the short weekday before the date.

## Fork only

- **Name**: local desktop builds are called "T3 Code (Majestic)", so the bundle installs next to the official app instead of replacing it.
- **Windows builds from Actions**: every push to `fork` builds an unsigned Windows x64 installer on GitHub's own runners and replaces it on the fork's [fork-windows release](https://github.com/fmajestic/t3code/releases/tag/fork-windows). The installed app finds newer builds by itself, so Check for updates works like any other build; the installer is the fallback. `.github/workflows/fork-windows-build.yml` has the details.
- **Header artwork**: choose the Beta build's header artwork under Settings > Appearance. The Dock icon follows your choice. Windows has no such setting, so its desktop, Start menu, and taskbar icons bake in the same Ridge badge.
- **Local updates**: a local macOS build updates from the checkout it was built from. Check for updates installs a newer app bundle from its release folder, or offers to build the checkout when it has moved to another commit; the build log is `release/fork-build.log`. `vp run fork:dist:desktop:app` builds from the terminal: only the `.app`, no DMG or zip, stamped with a version the update check can tell apart, replacing the bundles of earlier builds.
- **Signed local builds**: `vp run fork:dist:desktop:app` signs the app with a self-signed "T3 Fork Local" certificate, because macOS shows notifications only from apps signed by a trusted certificate. Run `scripts/fork-signing-identity.sh` once per Mac to create and trust it; it asks for your password. Without it, builds still work but cannot show notifications.
- **Regional date formats**: on macOS, dates and times use the order, separators and clock of the system region, while month and weekday names stay in the UI language.
- **`check:changed` compares against `fork`**: `vp run check:changed` also tries the local `fork` branch as a base, so a branch off `fork` checks only its own changes instead of every fork commit since `upstream/main`.
- **Triage reads the fork's source**: Triage an issue reads the checkout at `~/personal/t3code`, `~/projects/t3code` or `~/code/t3code` when it contains the commit the build came from, so nothing is downloaded. Without one, it clones that commit from the fork, or the tip of `fork` when the build does not record its commit, and skips vendored sources (`.repos/`, mobile `Vendor/`) and binary assets, about 25 MB instead of several hundred. The triage context tells `t3 triage` agents the same. `src/triage/forkSource.ts` holds the paths, remote and sparse patterns.
- **Dev server ignores `package.json`**: `vp run dev` no longer restarts the server when `apps/server/package.json` changes, because FortiClient's on-access scan touches the file and restarted it in a loop. Restart by hand after a dependency change.
- **Dev runner names its state directory**: the `[dev-runner]` line adds `stateDir=`, where the server keeps its database. In the main checkout `baseDir=~/.t3` reads like the live install, but dev state goes to `~/.t3/dev`; AGENTS.md says the same.
- **Sidebar sections**: Settings > Labs > Sidebar sections splits the active list into sections you name. Drag a thread onto a section, or use Move to section in its menu or the command palette. A thread joins a section through a `section:<id>` tag; the list of sections is a server setting. Pinned, Working, Snoozed and Settled still win. The title model files a new thread into the section that clearly fits its first message, in the same call that titles it, while the server has sections and the server setting under Sidebar sections allows it; the thread title instructions are where a user explains their sections. The thread-titles eval checks it with `--provider claude --initial --sections`. Agents manage sections with the `t3_sidebar_section` MCP tool, file threads with `t3_thread_organize` action `section`, and filter `t3_thread_list` by `sectionId`. Web and desktop only; `apps/web/src/components/sidebar/sections.logic.ts` and the section helpers in `packages/contracts/src/threadTags.ts` hold the rules.

## Syncing

Rebase `fork` onto `upstream/main`. Drop any commit from Ahead of upstream that upstream now covers.

A closed PR may have been superseded rather than abandoned: its closing comment usually names the replacement, which can cover only part of the commit, so keep what it leaves out and link the replacement.

If the closing comment names no replacement, read the comments on the issue the PR was fixing. GitHub only lists a PR on the issue when the PR says "Closes #<issue>", and some contributors link their PR in an issue comment instead.

When an entry gets an upstream PR, move it to From upstream PRs.

After rebasing, run `vp i`: upstream often changes dependencies, and builds, including the one behind the update button, fail until they are installed.

Install never downloads the Chromium that web browser tests run in. When a sync bumps `playwright` in `apps/web/package.json`, run `node apps/web/node_modules/playwright/cli.js install --only-shell chromium`, as CI does.
