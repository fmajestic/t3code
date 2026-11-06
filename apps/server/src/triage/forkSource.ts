// Fork-local: triage reads this fork's source, from a checkout on disk when there is one.

declare const __T3CODE_BUILD_COMMIT__: string | undefined;

/** Full commit hash the server was bundled from; undefined when it runs unbundled. */
export const BUILD_COMMIT =
  typeof __T3CODE_BUILD_COMMIT__ === "undefined" || __T3CODE_BUILD_COMMIT__ === ""
    ? undefined
    : __T3CODE_BUILD_COMMIT__;

export const FORK_REPOSITORY_URL = "https://github.com/fmajestic/t3code";
export const FORK_BRANCH = "fork";

/** Where this fork is checked out on the maintainer's machines, relative to home. */
export const LOCAL_CHECKOUT_DIRS = ["personal/t3code", "projects/t3code", "code/t3code"];

/** Non-cone sparse-checkout patterns: everything but vendored sources and binary assets. */
export const SPARSE_PATTERNS = [
  "/*",
  "!/.repos/",
  "!/assets/",
  "!/apps/mobile/modules/*/Vendor/",
  ...[
    "a",
    "so",
    "dylib",
    "node",
    "wasm",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "ico",
    "icns",
    "glb",
    "mp4",
    "mov",
    "pdf",
    "ttf",
    "otf",
    "woff",
    "woff2",
    "tgz",
    "zip",
    "ndjson",
  ].map((extension) => `!*.${extension}`),
];

const quote = (value: string) => `'${value}'`;

/** The commands the agent runs when the server could not clone for it. */
export const forkCloneSteps = (sourceCacheDir: string, buildCommit: string | undefined) => {
  const target = buildCommit ?? FORK_BRANCH;
  const directory = `${sourceCacheDir}/${buildCommit ?? "<commit>"}`;
  return `    git init ${directory} && cd ${directory}
    git remote add origin ${FORK_REPOSITORY_URL}
    git sparse-checkout set --no-cone ${SPARSE_PATTERNS.map(quote).join(" ")}
    git fetch --depth 1 --filter=blob:none origin ${target}
    git checkout FETCH_HEAD

${
  buildCommit === undefined
    ? `This build does not record its commit, so that clones the tip of \`${FORK_BRANCH}\`; treat file and line references as approximate.`
    : `If the fetch fails, the build's commit was never pushed: fetch \`${FORK_BRANCH}\` instead and treat file and line references as approximate.`
}`;
};
