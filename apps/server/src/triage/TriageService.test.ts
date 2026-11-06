import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { GitCommandError } from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import { ChildProcessSpawner } from "effect/process";

import * as ServerConfig from "../config.ts";
import * as GitVcsDriver from "../vcs/GitVcsDriver.ts";
import * as VcsProcess from "../vcs/VcsProcess.ts";
import * as TriageService from "./TriageService.ts";

const TestLayer = GitVcsDriver.layer.pipe(
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "t3-triage-service-" })),
  Layer.provideMerge(VcsProcess.layer),
  Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)),
);

const BUILD_COMMIT = "7027b1f";
const FORK_TIP = "a1dc856ee61278d0199c36d4bcdef5fdea4d21fe";

/** The service over a stub git that answers each command with `answer`. */
const makeTriage = (
  answer: (command: string) => Effect.Effect<string, GitCommandError> = (command) =>
    Effect.succeed(command === "rev-parse" ? `${BUILD_COMMIT}\n` : ""),
  options: Partial<TriageService.TriageSourceOptions> = {},
) =>
  Effect.gen(function* () {
    const git = yield* GitVcsDriver.GitVcsDriver;
    const commands: string[] = [];
    const triage = yield* Layer.build(
      TriageService.layerWith({ buildCommit: BUILD_COMMIT, localCheckouts: [], ...options }),
    ).pipe(
      Effect.map(Context.get(TriageService.TriageService)),
      Effect.provideService(GitVcsDriver.GitVcsDriver, {
        ...git,
        execute: (input) => {
          const command = input.args[0] ?? "";
          commands.push(command);
          return answer(command).pipe(
            Effect.map((stdout) => ({
              exitCode: ChildProcessSpawner.ExitCode(0),
              stdout,
              stderr: "",
              stdoutTruncated: false,
              stderrTruncated: false,
            })),
          );
        },
      }),
    );
    return { triage, commands };
  });

const gitFailure = (detail: string) =>
  new GitCommandError({ operation: "TriageService.test", command: "git", cwd: "/", detail });

const readContext = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const config = yield* ServerConfig.ServerConfig;
  const sessions = `${config.stateDir}/triage`;
  const [session] = yield* fs.readDirectory(sessions);
  return yield* fs.readFileString(`${sessions}/${session}/context.md`);
});

it.effect(
  "sessions started during a clone share it, and a known build commit needs no lookup",
  () =>
    Effect.gen(function* () {
      const fetches = yield* Queue.unbounded<void>();
      const { triage, commands } = yield* makeTriage((command) =>
        command === "fetch"
          ? Queue.offer(fetches, undefined).pipe(Effect.andThen(Effect.never))
          : Effect.succeed(""),
      );

      yield* triage.prepare({ client: {} });
      yield* triage.prepare({ client: {} });
      yield* Queue.take(fetches);

      assert.deepEqual(
        commands.filter((command) => command === "ls-remote" || command === "init"),
        ["init"],
      );
      assert.include(yield* readContext, `/source/${BUILD_COMMIT}  (commit ${BUILD_COMMIT})`);
    }).pipe(Effect.provide(TestLayer)),
);

it.effect("clones the tip of the fork branch when the build commit is unknown", () =>
  Effect.gen(function* () {
    const { triage } = yield* makeTriage(
      (command) => Effect.succeed(command === "ls-remote" ? `${FORK_TIP}\trefs/heads/fork\n` : ""),
      { buildCommit: undefined },
    );

    yield* triage.prepare({ client: {} });

    assert.include(yield* readContext, `/source/${FORK_TIP}  (commit ${FORK_TIP})`);
  }).pipe(Effect.provide(TestLayer)),
);

it.effect("reads a local checkout that has the build commit instead of cloning", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const config = yield* ServerConfig.ServerConfig;
    const stale = `${config.baseDir}/personal/t3code`;
    const current = `${config.baseDir}/code/t3code`;
    yield* fs.makeDirectory(`${stale}/.git`, { recursive: true });
    yield* fs.makeDirectory(`${current}/.git`, { recursive: true });
    let commitChecks = 0;
    const { triage, commands } = yield* makeTriage(
      (command) =>
        command === "cat-file" && ++commitChecks === 1
          ? Effect.fail(gitFailure("Not a valid object name"))
          : Effect.succeed(command === "rev-parse" ? `${FORK_TIP}\n` : ""),
      { localCheckouts: [`${config.baseDir}/missing/t3code`, stale, current] },
    );

    yield* triage.prepare({ client: {} });

    assert.deepEqual(commands, ["cat-file", "cat-file", "rev-parse"]);
    const context = yield* readContext;
    assert.include(context, `${current}  (HEAD ${FORK_TIP})`);
    assert.include(context, `show ${BUILD_COMMIT}:<path>`);
  }).pipe(Effect.provide(TestLayer)),
);

it.effect("reuses a finished clone without fetching", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const config = yield* ServerConfig.ServerConfig;
    yield* fs.makeDirectory(`${config.baseDir}/source/${BUILD_COMMIT}/.git`, {
      recursive: true,
    });
    const { triage, commands } = yield* makeTriage();

    yield* triage.prepare({ client: {} });

    assert.deepEqual(commands, ["rev-parse"]);
    assert.include(yield* readContext, "The server cloned it");
  }).pipe(Effect.provide(TestLayer)),
);

it.effect("still starts triage when the source lookup fails", () =>
  Effect.gen(function* () {
    const { triage } = yield* makeTriage(
      () => Effect.fail(gitFailure("Could not resolve host: github.com")),
      { buildCommit: undefined },
    );

    const { prompt } = yield* triage.prepare({ client: {} });

    assert.include(prompt, "triage-playbook.md");
    assert.include(yield* readContext, "Could not resolve host: github.com");
  }).pipe(Effect.provide(TestLayer)),
);

it.effect("does not trust a folder without its own .git, even inside a repo at that commit", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const config = yield* ServerConfig.ServerConfig;
    yield* fs.makeDirectory(`${config.baseDir}/source/${BUILD_COMMIT}`, { recursive: true });
    // The stub answers rev-parse with the commit, as a parent repository could.
    const { triage, commands } = yield* makeTriage();

    yield* triage.prepare({ client: {} });

    assert.notInclude(commands, "rev-parse");
    assert.include(yield* readContext, "is not a complete checkout");
  }).pipe(Effect.provide(TestLayer)),
);
