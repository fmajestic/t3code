// @effect-diagnostics nodeBuiltinImport:off -- The swap script is detached so it outlives this process.
// Fork-local: unpublished macOS builds update by reinstalling the newest zip from the
// release directory of the checkout that built them. build-desktop-artifact.ts bakes that
// directory into the packaged package.json as `t3LocalReleaseDir`.
import * as NodeChildProcess from "node:child_process";
import * as NodeUtil from "node:util";

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

const PackagedMetadata = Schema.Struct({ t3LocalReleaseDir: Schema.optionalKey(Schema.String) });
const decodePackagedMetadata = Schema.decodeUnknownOption(Schema.fromJsonString(PackagedMetadata));

export interface ReleaseZip {
  readonly name: string;
  readonly mtimeMs: number;
}

export function newestReleaseZip(
  zips: ReadonlyArray<ReleaseZip>,
  arch: string,
): Option.Option<ReleaseZip> {
  const suffix = `-${arch}.zip`;
  return zips
    .filter((zip) => zip.name.startsWith("T3-Code-") && zip.name.endsWith(suffix))
    .reduce<Option.Option<ReleaseZip>>(
      (newest, zip) =>
        Option.isSome(newest) && newest.value.mtimeMs >= zip.mtimeMs ? newest : Option.some(zip),
      Option.none(),
    );
}

/** `T3-Code-0.0.46-fork.20261008.930-arm64.zip` -> `0.0.46-fork.20261008.930` */
export function releaseZipVersion(name: string): string {
  return /^T3-Code-(.+)-[^-]+\.zip$/.exec(name)?.[1] ?? name;
}

/** `/x/Foo.app/Contents/MacOS/Foo` -> `/x/Foo.app` */
export function appBundleFromExecPath(execPath: string): Option.Option<string> {
  const match = /^(.+\.app)\/Contents\/MacOS\/[^/]+$/.exec(execPath);
  return match?.[1] === undefined ? Option.none() : Option.some(match[1]);
}

// Positional args: pid, installed bundle, extracted bundle.
const SWAP_SCRIPT = `
while kill -0 "$1" 2>/dev/null; do sleep 0.2; done
rm -rf "$2" && mv "$3" "$2" && rmdir "$(dirname "$3")"
open "$2"
`;

export const readLocalReleaseDir = (fileSystem: FileSystem.FileSystem, appPath: string) =>
  fileSystem.readFileString(`${appPath}/package.json`).pipe(
    Effect.map((raw) =>
      decodePackagedMetadata(raw).pipe(
        Option.flatMap((metadata) => Option.fromNullishOr(metadata.t3LocalReleaseDir)),
      ),
    ),
    Effect.orElseSucceed(() => Option.none<string>()),
  );

export interface LocalUpdate {
  readonly zipPath: string;
  /** Identifies one zip build, so a repeat check reuses the copy already staged. */
  readonly buildId: string;
  readonly label: string;
}

export function localUpdateLabel(zip: ReleaseZip): string {
  const version = releaseZipVersion(zip.name);
  const builtAt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(zip.mtimeMs);
  return `${version} (built ${builtAt})`;
}

/**
 * The newest release zip, or none when it is the running build. replace-desktop-app.sh stamps
 * every build with its own version, so a matching version means the same build.
 */
export const findLocalUpdate = Effect.fn("desktop.updates.findLocalUpdate")(function* (input: {
  readonly fileSystem: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly releaseDir: string;
  readonly arch: string;
  readonly installedVersion: string;
}) {
  const { fileSystem, path } = input;
  const names = yield* fileSystem
    .readDirectory(input.releaseDir)
    .pipe(
      Effect.mapError(
        () => new LocalAppReplaceError({ message: `Cannot read ${input.releaseDir}` }),
      ),
    );
  const zips = yield* Effect.forEach(names, (name) =>
    fileSystem.stat(path.join(input.releaseDir, name)).pipe(
      Effect.map((info) => ({
        name,
        mtimeMs: Option.match(info.mtime, { onNone: () => 0, onSome: (date) => date.getTime() }),
      })),
      Effect.orElseSucceed(() => ({ name, mtimeMs: 0 })),
    ),
  );
  const zip = yield* Option.match(newestReleaseZip(zips, input.arch), {
    onNone: () =>
      Effect.fail(
        new LocalAppReplaceError({
          message: `No T3-Code-*-${input.arch}.zip in ${input.releaseDir}`,
        }),
      ),
    onSome: Effect.succeed,
  });
  const zipPath = path.join(input.releaseDir, zip.name);
  return releaseZipVersion(zip.name) === input.installedVersion
    ? Option.none<LocalUpdate>()
    : Option.some<LocalUpdate>({
        zipPath,
        buildId: `${zipPath}@${zip.mtimeMs}`,
        label: localUpdateLabel(zip),
      });
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
  yield* Effect.tryPromise({
    try: () => execFile("/usr/bin/ditto", ["-x", "-k", update.zipPath, stagingDir]),
    catch: () => fail(`Could not extract ${update.zipPath}`),
  });
  const extracted = path.join(stagingDir, path.basename(bundle));
  if (!(yield* fileSystem.exists(extracted).pipe(Effect.orElseSucceed(() => false)))) {
    yield* fileSystem.remove(stagingDir, { recursive: true }).pipe(Effect.ignore);
    return yield* fail(`${update.zipPath} does not contain ${path.basename(bundle)}`);
  }

  const swap = Effect.sync(() => {
    NodeChildProcess.spawn(
      "/bin/sh",
      ["-c", SWAP_SCRIPT, "sh", String(process.pid), bundle, extracted],
      { detached: true, stdio: "ignore" },
    ).unref();
  });
  return { update, stagingDir, swap } satisfies StagedLocalUpdate;
});
