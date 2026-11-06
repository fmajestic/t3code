// @effect-diagnostics nodeBuiltinImport:off
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import {
  type AuthClientPresentationMetadata,
  ServerPrepareTriageError,
  type ServerPrepareTriageInput,
  type ServerPrepareTriageResult,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import packageJson from "../../package.json" with { type: "json" };
import * as ServerConfig from "../config.ts";
import * as GitVcsDriver from "../vcs/GitVcsDriver.ts";
import {
  BUILD_COMMIT,
  FORK_BRANCH,
  FORK_REPOSITORY_URL,
  LOCAL_CHECKOUT_DIRS,
  SPARSE_PATTERNS,
} from "./forkSource.ts";
import { buildTriageAppPrompt, type TriageSourceClone } from "./triagePrompt.ts";
import { triageSourceCacheDir, writeTriageSession } from "./triageSession.ts";

// No tty: a credential prompt would hang until the timeout, so git must fail
// instead. An empty GIT_ASKPASS also skips core.askPass and SSH_ASKPASS helpers.
const GIT_ENV = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
  // English messages without overriding LC_CTYPE, which a global post-checkout hook inherits.
  LANGUAGE: "C",
} satisfies NodeJS.ProcessEnv;

/** Starts in-app triage sessions: the same files `t3 triage` writes, plus a source clone. */
export class TriageService extends Context.Service<
  TriageService,
  {
    readonly prepare: (
      input: ServerPrepareTriageInput,
    ) => Effect.Effect<ServerPrepareTriageResult, ServerPrepareTriageError>;
  }
>()("t3/triage/TriageService") {}

const describeClient = (client: AuthClientPresentationMetadata) =>
  [
    client.label ?? "an unknown client",
    client.appVersion === undefined ? undefined : `version ${client.appVersion}`,
    client.os === undefined ? undefined : `on ${client.os}`,
    client.browser === undefined ? undefined : `in ${client.browser}`,
    client.webDeployment === "hosted" ? "(app.t3.codes)" : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(" ");

export interface TriageSourceOptions {
  /** The commit this server was built from, when known. */
  readonly buildCommit: string | undefined;
  /** Checkouts of the fork to read in place of a clone, in order. */
  readonly localCheckouts: ReadonlyArray<string>;
}

const make = Effect.fn("TriageService.make")(function* (options: TriageSourceOptions) {
  const config = yield* ServerConfig.ServerConfig;
  const git = yield* GitVcsDriver.GitVcsDriver;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceDir = triageSourceCacheDir(config.baseDir, path);
  // Beside the cache, not in it: the playbook has agents prune the cache, and a
  // clone in progress must not look like a stale entry. Same filesystem, so the
  // finished clone moves in with a rename.
  const stagingDir = `${sourceDir}-staging`;
  const { buildCommit } = options;

  const runGit = (operation: string, cwd: string, args: ReadonlyArray<string>, timeoutMs: number) =>
    git.execute({ operation: `TriageService.${operation}`, cwd, args, timeoutMs, env: GIT_ENV });

  // Clones outlive the request that started them: a fresh clone takes tens of
  // seconds, and the user is writing their description meanwhile.
  const serviceScope = yield* Effect.scope;
  // Clones a previous server process left half done.
  yield* fs.remove(stagingDir, { recursive: true }).pipe(Effect.ignore);

  // The first checkout on disk that has the build's commit, so nothing is downloaded.
  const findLocalCheckout = Effect.fn("TriageService.findLocalCheckout")(function* () {
    for (const directory of options.localCheckouts) {
      if (!(yield* fs.exists(path.join(directory, ".git")))) continue;
      const hasCommit =
        buildCommit === undefined ||
        (yield* runGit(
          "checkLocalCommit",
          directory,
          ["cat-file", "-e", `${buildCommit}^{commit}`],
          10_000,
        ).pipe(
          Effect.as(true),
          Effect.orElseSucceed(() => false),
        ));
      if (!hasCommit) continue;
      const head = yield* runGit("checkLocalHead", directory, ["rev-parse", "HEAD"], 10_000).pipe(
        Effect.map((result) => result.stdout.trim()),
        Effect.option,
      );
      if (Option.isSome(head)) return Option.some({ directory, head: head.value });
    }
    return Option.none<{ readonly directory: string; readonly head: string }>();
  });

  // Fetches the exact commit, so the folder the session names is the one that
  // appears even when the branch moves meanwhile.
  const cloneSource = Effect.fn("TriageService.cloneSource")(function* (commit: string) {
    yield* fs.makeDirectory(stagingDir, { recursive: true });
    const staging = yield* fs.makeTempDirectory({ directory: stagingDir, prefix: "clone-" });
    const directory = path.join(sourceDir, commit);
    yield* Effect.gen(function* () {
      yield* runGit("initSource", staging, ["init", "--quiet"], 10_000);
      yield* runGit(
        "addSourceRemote",
        staging,
        ["remote", "add", "origin", FORK_REPOSITORY_URL],
        10_000,
      );
      yield* runGit(
        "sparseSource",
        staging,
        ["sparse-checkout", "set", "--no-cone", ...SPARSE_PATTERNS],
        10_000,
      );
      yield* runGit(
        "fetchSource",
        staging,
        ["fetch", "--depth", "1", "--filter=blob:none", "origin", commit],
        600_000,
      );
      yield* runGit("checkoutSource", staging, ["checkout", "--quiet", "FETCH_HEAD"], 600_000);
      yield* fs.rename(staging, directory).pipe(
        // A concurrent session cloned the same commit first; keep theirs.
        Effect.catch((error) =>
          fs
            .exists(directory)
            .pipe(Effect.flatMap((exists) => (exists ? Effect.void : Effect.fail(error)))),
        ),
      );
    }).pipe(
      // Gone after a successful rename; otherwise a failed or losing clone.
      Effect.ensuring(fs.remove(staging, { recursive: true }).pipe(Effect.ignore)),
    );
  });

  // Without a recorded build commit, the tip of the fork branch is the closest match.
  const resolveCommit = Effect.fn("TriageService.resolveCommit")(function* () {
    if (buildCommit !== undefined) return buildCommit;
    const listed = yield* runGit(
      "resolveSourceRef",
      sourceDir,
      ["ls-remote", FORK_REPOSITORY_URL, `refs/heads/${FORK_BRANCH}`],
      // Triage still starts without source; a dead network should not stall it.
      5_000,
    );
    return listed.stdout.trim().split("\t")[0] || undefined;
  });

  // Commits with a clone running, so sessions started meanwhile share it.
  const cloning = new Set<string>();

  // The playbook's own layout: one folder per commit under the source cache, so
  // the agent finds and reuses this clone instead of making another. The folder
  // appears only once the clone is complete.
  const startSourceClone = Effect.fn("TriageService.startSourceClone")(function* () {
    const local = yield* findLocalCheckout();
    if (Option.isSome(local)) return { _tag: "local", ...local.value } satisfies TriageSourceClone;
    yield* fs.makeDirectory(sourceDir, { recursive: true });
    const commit = yield* resolveCommit();
    if (commit === undefined) {
      return {
        _tag: "failed",
        reason: `the fork did not list its \`${FORK_BRANCH}\` branch.`,
      } satisfies TriageSourceClone;
    }
    const directory = path.join(sourceDir, commit);
    if (yield* fs.exists(directory)) {
      // Our clones appear only when complete, but an agent may have cloned
      // here by hand and stopped partway.
      // Without its own .git, rev-parse would read a parent repository.
      const head = (yield* fs.exists(path.join(directory, ".git")))
        ? yield* runGit("checkSource", directory, ["rev-parse", "HEAD"], 10_000).pipe(
            Effect.map((result) => result.stdout.trim()),
            Effect.orElseSucceed(() => ""),
          )
        : "";
      return head === commit
        ? ({ _tag: "cloned", directory, commit } as const)
        : ({
            _tag: "failed",
            reason: `${directory} exists but is not a complete checkout of ${commit}. Remove it first.`,
          } satisfies TriageSourceClone);
    }
    if (!cloning.has(commit)) {
      cloning.add(commit);
      yield* cloneSource(commit).pipe(
        Effect.ignoreCause({ log: true }),
        Effect.ensuring(Effect.sync(() => cloning.delete(commit))),
        Effect.forkIn(serviceScope),
      );
    }
    return { _tag: "cloning", directory, commit } as const;
  });

  const prepare: TriageService["Service"]["prepare"] = Effect.fn("TriageService.prepare")(
    function* (input) {
      const sourceClone = yield* startSourceClone().pipe(
        Effect.catch((error) =>
          Effect.succeed<TriageSourceClone>({ _tag: "failed", reason: error.message }),
        ),
      );
      const session = yield* writeTriageSession({
        baseDir: config.baseDir,
        paths: config,
        entry: { kind: "app", client: describeClient(input.client) },
        server: `running (pid ${String(process.pid)}, version ${packageJson.version}); this session runs inside it`,
        sourceClone,
        buildCommit,
      }).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
        Effect.mapError((cause) => new ServerPrepareTriageError({ cause })),
      );
      return { prompt: buildTriageAppPrompt(session.promptFilePath) };
    },
  );

  return TriageService.of({ prepare });
});

export const layerWith = (options: TriageSourceOptions) =>
  Layer.effect(TriageService, make(options));

export const layer = Layer.effect(
  TriageService,
  Effect.suspend(() =>
    make({
      buildCommit: BUILD_COMMIT,
      localCheckouts: LOCAL_CHECKOUT_DIRS.map((dir) => NodePath.join(NodeOS.homedir(), dir)),
    }),
  ),
);
