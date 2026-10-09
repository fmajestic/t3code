// @effect-diagnostics nodeBuiltinImport:off -- The build and swap run as their own process groups.
// Fork-local: unpublished macOS builds update by building the checkout that built them and
// reinstalling the newest app bundle from its release directory. build-desktop-artifact.ts bakes that
// directory into the packaged package.json as `t3LocalReleaseDir`.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeUtil from "node:util";

import { createDateTimeFormatter, type DateTimeLocale } from "@t3tools/shared/dateTimeLocale";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

const execFile = NodeUtil.promisify(NodeChildProcess.execFile);

export class LocalAppReplaceError extends Schema.TaggedError<LocalAppReplaceError>()(
  "LocalAppReplaceError",
  { message: Schema.String },
) {}

const PackagedMetadata = Schema.Struct({
  t3LocalReleaseDir: Schema.optionalKey(Schema.String),
  t3codeCommitHash: Schema.optionalKey(Schema.String),
});
const decodePackagedMetadata = Schema.decodeUnknownOption(Schema.fromJsonString(PackagedMetadata));

export interface ReleaseApp {
  readonly name: string;
  readonly mtimeMs: number;
}

export function newestReleaseApp(
  apps: ReadonlyArray<ReleaseApp>,
  arch: string,
): Option.Option<ReleaseApp> {
  const suffix = `-${arch}.app`;
  return apps
    .filter((app) => app.name.startsWith("T3-Code-") && app.name.endsWith(suffix))
    .reduce<Option.Option<ReleaseApp>>(
      (newest, app) =>
        Option.isSome(newest) && newest.value.mtimeMs >= app.mtimeMs ? newest : Option.some(app),
      Option.none(),
    );
}

/** `T3-Code-0.0.46-fork.20261008.930-arm64.app` -> `0.0.46-fork.20261008.930` */
export function releaseAppVersion(name: string): string {
  return /^T3-Code-(.+)-[^-]+\.app$/.exec(name)?.[1] ?? name;
}

/** `/x/Foo.app/Contents/MacOS/Foo` -> `/x/Foo.app` */
export function appBundleFromExecPath(execPath: string): Option.Option<string> {
  const match = /^(.+\.app)\/Contents\/MacOS\/[^/]+$/.exec(execPath);
  return match?.[1] === undefined ? Option.none() : Option.some(match[1]);
}

// Positional args: pid, installed bundle, staged bundle.
const SWAP_SCRIPT = `
while kill -0 "$1" 2>/dev/null; do sleep 0.2; done
rm -rf "$2" && mv "$3" "$2" && rmdir "$(dirname "$3")"
# A bundle replaced in place keeps its old cached icon until LaunchServices sees it change.
touch "$2" && /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$2"
open "$2"
`;

export interface LocalBuildInfo {
  readonly releaseDir: string;
  /** Short hash of the commit the running build came from. */
  readonly commitHash: Option.Option<string>;
}

export const readLocalBuildInfo = (fileSystem: FileSystem.FileSystem, appPath: string) =>
  fileSystem.readFileString(`${appPath}/package.json`).pipe(
    Effect.map((raw) =>
      decodePackagedMetadata(raw).pipe(
        Option.flatMap(({ t3LocalReleaseDir, t3codeCommitHash }) =>
          Option.fromNullishOr(t3LocalReleaseDir).pipe(
            Option.map((releaseDir): LocalBuildInfo => ({
              releaseDir,
              commitHash: Option.fromNullishOr(t3codeCommitHash),
            })),
          ),
        ),
      ),
    ),
    Effect.orElseSucceed(() => Option.none<LocalBuildInfo>()),
  );

const git = (releaseDir: string, args: ReadonlyArray<string>) =>
  Effect.tryPromise({
    try: () => execFile("git", ["-C", releaseDir, ...args]),
    catch: () =>
      new LocalAppReplaceError({ message: `${releaseDir} is not inside a git checkout` }),
  }).pipe(Effect.map(({ stdout }) => stdout.trim()));

/** The checkout's HEAD as a short hash, or none when it is the commit the running build came from. */
export const findNewCommit = Effect.fn("desktop.updates.findNewCommit")(function* (
  build: LocalBuildInfo,
) {
  const head = yield* git(build.releaseDir, ["rev-parse", "HEAD"]);
  return Option.isSome(build.commitHash) && head.startsWith(build.commitHash.value)
    ? Option.none<string>()
    : Option.some(head.slice(0, 12));
});

export const BUILD_LOG_NAME = "fork-build.log";

const BUILD_OUTPUT_LINES = 3;

/** Keeps the last few non-empty lines of a stream that may redraw lines with `\r`. */
export function appendBuildOutput(
  lines: ReadonlyArray<string>,
  pending: string,
  chunk: string,
): { readonly lines: ReadonlyArray<string>; readonly pending: string } {
  const parts = NodeUtil.stripVTControlCharacters(pending + chunk).split(/\r\n|\r|\n/);
  const rest = parts.pop() ?? "";
  const complete = parts.map((line) => line.trim()).filter((line) => line.length > 0);
  return { lines: [...lines, ...complete].slice(-BUILD_OUTPUT_LINES), pending: rest };
}

/** Runs `fork:dist:desktop:app` in the checkout, logging to the release directory. */
export const buildLocalUpdate = Effect.fn("desktop.updates.buildLocalUpdate")(function* (input: {
  readonly fileSystem: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly releaseDir: string;
  /** Called with the latest output lines; must not block. */
  readonly onOutput: (lines: ReadonlyArray<string>) => void;
}) {
  const repoDir = yield* git(input.releaseDir, ["rev-parse", "--show-toplevel"]);
  const logPath = input.path.join(input.releaseDir, BUILD_LOG_NAME);
  yield* input.fileSystem
    .makeDirectory(input.releaseDir, { recursive: true })
    .pipe(
      Effect.mapError(
        () => new LocalAppReplaceError({ message: `Cannot create ${input.releaseDir}` }),
      ),
    );
  yield* Effect.callback<void, LocalAppReplaceError>((resume) => {
    const log = NodeFS.createWriteStream(logPath);
    // Its own process group, so interrupting kills the build and not just vp.
    const child = NodeChildProcess.spawn("vp", ["run", "fork:dist:desktop:app"], {
      cwd: repoDir,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = { lines: [] as ReadonlyArray<string>, pending: "" };
    const onData = (chunk: Buffer) => {
      log.write(chunk);
      output = appendBuildOutput(output.lines, output.pending, chunk.toString("utf8"));
      input.onOutput(output.lines);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("error", (error) => {
      log.end();
      resume(
        Effect.fail(new LocalAppReplaceError({ message: `Could not start vp: ${error.message}` })),
      );
    });
    // "close" rather than "exit", so the log has every chunk before the build counts as done.
    child.once("close", (code) => {
      log.end();
      resume(
        code === 0
          ? Effect.void
          : Effect.fail(new LocalAppReplaceError({ message: `Build failed, see ${logPath}` })),
      );
    });
    return Effect.sync(() => {
      if (child.pid !== undefined && child.exitCode === null) process.kill(-child.pid, "SIGTERM");
    });
  });
});

export interface LocalUpdate {
  readonly appPath: string;
  /** Identifies one build, so a repeat check reuses the copy already staged. */
  readonly buildId: string;
  readonly label: string;
}

export function localUpdateLabel(app: ReleaseApp, locale: DateTimeLocale): string {
  const version = releaseAppVersion(app.name);
  const builtAt = createDateTimeFormatter(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(app.mtimeMs);
  return `${version} (built ${builtAt})`;
}

/**
 * The newest release app bundle, or none when it is the running build or there is none.
 * fork-dist-desktop.ts stamps every build with its own version, so a matching version means
 * the same build.
 */
export const findLocalUpdate = Effect.fn("desktop.updates.findLocalUpdate")(function* (input: {
  readonly fileSystem: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly releaseDir: string;
  readonly arch: string;
  readonly installedVersion: string;
  readonly locale: DateTimeLocale;
}) {
  const { fileSystem, path } = input;
  const names = yield* fileSystem
    .readDirectory(input.releaseDir)
    .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
  const apps = yield* Effect.forEach(names, (name) =>
    fileSystem.stat(path.join(input.releaseDir, name)).pipe(
      Effect.map((info) => ({
        name,
        mtimeMs: Option.match(info.mtime, { onNone: () => 0, onSome: (date) => date.getTime() }),
      })),
      Effect.orElseSucceed(() => ({ name, mtimeMs: 0 })),
    ),
  );
  return newestReleaseApp(apps, input.arch).pipe(
    Option.filter((app) => releaseAppVersion(app.name) !== input.installedVersion),
    Option.map((app): LocalUpdate => {
      const appPath = path.join(input.releaseDir, app.name);
      return {
        appPath,
        buildId: `${appPath}@${app.mtimeMs}`,
        label: localUpdateLabel(app, input.locale),
      };
    }),
  );
});

export interface StagedLocalUpdate {
  readonly update: LocalUpdate;
  readonly stagingDir: string;
  /** Starts a detached script that replaces the bundle once this process exits; then quit. */
  readonly swap: Effect.Effect<void>;
}

export const stageLocalUpdate = Effect.fn("desktop.updates.stageLocalUpdate")(function* (input: {
  readonly fileSystem: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly update: LocalUpdate;
}) {
  const { fileSystem, path, update } = input;
  const fail = (message: string) => new LocalAppReplaceError({ message });

  const bundle = yield* Option.match(appBundleFromExecPath(process.execPath), {
    onNone: () => Effect.fail(fail(`Not running from an app bundle: ${process.execPath}`)),
    onSome: Effect.succeed,
  });
  const stagingDir = yield* fileSystem
    .makeTempDirectory({ prefix: "t3-replace-" })
    .pipe(Effect.mapError(() => fail("Cannot create a staging directory")));
  const staged = path.join(stagingDir, path.basename(bundle));
  // -c clones on APFS, so staging copies no data and the release bundle stays for the next check.
  yield* Effect.tryPromise({
    try: () => execFile("/bin/cp", ["-Rpc", update.appPath, staged]),
    catch: () => fail(`Could not copy ${update.appPath}`),
  }).pipe(
    Effect.tapError(() => fileSystem.remove(stagingDir, { recursive: true }).pipe(Effect.ignore)),
  );

  const swap = Effect.sync(() => {
    NodeChildProcess.spawn(
      "/bin/sh",
      ["-c", SWAP_SCRIPT, "sh", String(process.pid), bundle, staged],
      { detached: true, stdio: "ignore" },
    ).unref();
  });
  return { update, stagingDir, swap } satisfies StagedLocalUpdate;
});
