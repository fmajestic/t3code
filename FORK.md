# T3 Code (Majestic)

A personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). The `fork` branch is `upstream/main` with a few commits rebased on top. Mostly they pull in fixes and features before upstream merges them, plus a few changes that only make sense for this fork.

## Ahead of upstream

Each of these is meant to be dropped once upstream has it, through its own PR or an equivalent fix.

### From upstream PRs

None right now.

### Not in an upstream PR

- **"Continue with \<model\>" after a usage limit**: picking another model in the composer while a thread is stopped on a usage limit labels the resume button "Continue with \<model\>". Upstream merged resuming on the picked model in [#17867](https://github.com/pingdotgg/t3code/pull/17867) and closed [#16889](https://github.com/pingdotgg/t3code/pull/16889), which also had this label.

## Fork only

- **Name**: local desktop builds are called "T3 Code (Majestic)", so the bundle installs next to the official app instead of replacing it.
- **Header artwork**: choose the Beta build's header artwork under Settings > Appearance. The Dock icon follows your choice. Windows has no such setting, so its desktop, Start menu, and taskbar icons bake in the same Ridge badge, and so do the favicon and home-screen icons of the web client a desktop build serves. The Ridge icons come from the Icon Composer project `assets/majestic/app-icon.icon`, which `vp run icons:export` exports with the upstream ones; export the macOS PNG to `assets/majestic/ridge-macos-1024.png` by hand, as `assets/README.md` describes. The live Dock icon is drawn in the app, so it imitates the glass edge instead.
- **Local updates**: a local macOS build updates from the checkout it was built from. Check for updates installs a newer app bundle from its release folder, or offers to build the checkout when it has moved to another commit; the build log is `release/fork-build.log`. `vp run fork:dist:desktop:app` builds from the terminal: only the `.app`, no DMG or zip, stamped with a version the update check can tell apart, replacing the bundles of earlier builds.
- **Signed local builds**: `vp run fork:dist:desktop:app` signs the app with a self-signed "T3 Fork Local" certificate, because macOS shows notifications only from apps signed by a trusted certificate. Run `scripts/fork-signing-identity.sh` once per Mac to create and trust it; it asks for your password. Without it, builds still work but cannot show notifications.

## Syncing

Rebase `fork` onto `upstream/main`. Drop any commit from Ahead of upstream that upstream now covers.

A closed PR may have been superseded rather than abandoned: its closing comment usually names the replacement, which can cover only part of the commit, so keep what it leaves out and link the replacement.

If the closing comment names no replacement, read the comments on the issue the PR was fixing. GitHub only lists a PR on the issue when the PR says "Closes #<issue>", and some contributors link their PR in an issue comment instead.

When an entry gets an upstream PR, move it to From upstream PRs.

After rebasing, run `vp i`: upstream often changes dependencies, and builds, including the one behind the update button, fail until they are installed.

Install never downloads the Chromium that web browser tests run in. When a sync bumps `playwright` in `apps/web/package.json`, run `node apps/web/node_modules/playwright/cli.js install --only-shell chromium`, as CI does.
