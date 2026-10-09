#!/usr/bin/env node
// Fork-local: build the arm64 desktop app bundle, unpackaged, with a version the in-app local
// update can tell apart, and drop the bundles of earlier builds.
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { updateReleasePackageVersions } from "./update-release-package-versions.ts";

class ForkDistBuildFailedError extends Schema.TaggedError<ForkDistBuildFailedError>()(
  "ForkDistBuildFailedError",
  { exitCode: Schema.Int },
) {
  override get message(): string {
    return `build-desktop-artifact.ts exited with code ${this.exitCode}.`;
  }
}

const decodeVersion = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Struct({ version: Schema.String })),
);

/**
 * The next patch as a prerelease shaped like nightly's `<date>.<run>`, because provider
 * compatibility policies in model-manifest.json are keyed on the version baked into the build.
 */
export function forkBuildVersion(baseVersion: string, now: DateTime.DateTime): string {
  const [major, minor, patch] = baseVersion.split(".").map(Number);
  const local = DateTime.toParts(DateTime.setZone(now, DateTime.zoneMakeLocal()));
  const date = `${local.year}${String(local.month).padStart(2, "0")}${String(local.day).padStart(2, "0")}`;
  // hhmm as a number, since semver forbids the leading zero in 0930.
  return `${major}.${minor}.${Number(patch) + 1}-fork.${date}.${local.hour * 100 + local.minute}`;
}

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const rootDir = yield* path.fromFileUrl(new URL("..", import.meta.url));
  const { version: baseVersion } = yield* fs
    .readFileString(path.join(rootDir, "apps/server/package.json"))
    .pipe(Effect.flatMap(decodeVersion));
  const buildVersion = forkBuildVersion(baseVersion, yield* DateTime.now);

  yield* Effect.acquireUseRelease(
    updateReleasePackageVersions(buildVersion, { rootDir }),
    () =>
      Effect.gen(function* () {
        const child = yield* spawner.spawn(
          ChildProcess.make(
            "node",
            [
              "scripts/build-desktop-artifact.ts",
              "--platform",
              "mac",
              "--target",
              "dir",
              "--arch",
              "arm64",
            ],
            {
              cwd: rootDir,
              env: { T3CODE_DESKTOP_VERSION: buildVersion },
              extendEnv: true,
              stdout: "inherit",
              stderr: "inherit",
            },
          ),
        );
        const exitCode = Number(yield* child.exitCode);
        if (exitCode !== 0) return yield* new ForkDistBuildFailedError({ exitCode });
      }).pipe(Effect.scoped),
    () => updateReleasePackageVersions(baseVersion, { rootDir }).pipe(Effect.orDie),
  );

  const releaseDir = path.join(rootDir, "release");
  const built = `T3-Code-${buildVersion}-arm64.app`;
  for (const name of yield* fs.readDirectory(releaseDir)) {
    if (name !== built && /^T3-Code-.+-arm64\.app$/.test(name)) {
      yield* fs.remove(path.join(releaseDir, name), { recursive: true });
    }
  }
});

if (import.meta.main) {
  program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
