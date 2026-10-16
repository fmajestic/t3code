import type {
  OrchestrationV2ProviderTurn,
  OrchestrationV2ThreadProjection,
  ProviderThreadId,
  RunId,
} from "@t3tools/contracts";
import { formatTokens } from "@t3tools/shared/usageFormat";

export type RunContextGrowth =
  | { readonly kind: "grew"; readonly tokens: number }
  | { readonly kind: "shrank"; readonly usedTokens: number };

type GrowthTurn = Pick<
  OrchestrationV2ProviderTurn,
  "providerThreadId" | "runAttemptId" | "ordinal" | "status" | "tokenUsage"
>;

/**
 * How much each settled run grew its provider thread's context window. A run is
 * left out when any of its turns lacks a measured predecessor: the turn before it
 * is outside the loaded window, belongs to an unloaded run, or reported no usage.
 */
export function deriveRunContextGrowth(projection: {
  readonly runs: ReadonlyArray<
    Pick<OrchestrationV2ThreadProjection["runs"][number], "id" | "status">
  >;
  readonly attempts: ReadonlyArray<
    Pick<OrchestrationV2ThreadProjection["attempts"][number], "id" | "runId">
  >;
  readonly providerTurns: ReadonlyArray<GrowthTurn>;
}): ReadonlyMap<RunId, RunContextGrowth> {
  const runStatusById = new Map(projection.runs.map((run) => [run.id, run.status]));
  const runIdByAttemptId = new Map(
    projection.attempts.map((attempt) => [attempt.id, attempt.runId]),
  );
  const turnsByProviderThread = new Map<ProviderThreadId, GrowthTurn[]>();
  for (const turn of projection.providerTurns) {
    const turns = turnsByProviderThread.get(turn.providerThreadId) ?? [];
    turns.push(turn);
    turnsByProviderThread.set(turn.providerThreadId, turns);
  }

  const totals = new Map<RunId, { grew: number; shrankTo: number | null } | null>();
  for (const turns of turnsByProviderThread.values()) {
    turns.sort((a, b) => a.ordinal - b.ordinal);
    let previousOrdinal = 0;
    let baseline: number | null = 0;
    for (const turn of turns) {
      if (turn.ordinal !== previousOrdinal + 1) baseline = null;
      previousOrdinal = turn.ordinal;
      const runId =
        turn.runAttemptId === null ? undefined : runIdByAttemptId.get(turn.runAttemptId);
      const runStatus = runId === undefined ? undefined : runStatusById.get(runId);
      if (runId === undefined || runStatus === undefined) {
        baseline = null;
        continue;
      }
      // The provider rewound past a rolled-back turn, so the next turn grows from the rollback target.
      if (runStatus === "rolled_back") continue;
      const used = turn.tokenUsage?.usedTokens ?? null;
      const total = totals.has(runId) ? totals.get(runId)! : { grew: 0, shrankTo: null };
      // A running turn's usage is still moving, and recomputing rows on every report is costly.
      const settled = turn.status !== "pending" && turn.status !== "running";
      if (total === null || used === null || baseline === null || !settled) {
        totals.set(runId, null);
      } else if (used < baseline) {
        totals.set(runId, { grew: 0, shrankTo: used });
      } else {
        totals.set(runId, {
          grew: total.grew + used - baseline,
          shrankTo: total.shrankTo === null ? null : used,
        });
      }
      baseline = used;
    }
  }

  const growth = new Map<RunId, RunContextGrowth>();
  for (const [runId, total] of totals) {
    if (total === null) continue;
    if (total.shrankTo !== null) growth.set(runId, { kind: "shrank", usedTokens: total.shrankTo });
    else if (total.grew > 0) growth.set(runId, { kind: "grew", tokens: total.grew });
  }
  return growth;
}

export function sameRunContextGrowth(
  a: RunContextGrowth | undefined,
  b: RunContextGrowth | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.kind === "grew") return b.kind === "grew" && a.tokens === b.tokens;
  return b.kind === "shrank" && a.usedTokens === b.usedTokens;
}

export function sameRunContextGrowthMap(
  a: ReadonlyMap<RunId, RunContextGrowth>,
  b: ReadonlyMap<RunId, RunContextGrowth>,
): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [runId, growth] of a) {
    if (!sameRunContextGrowth(growth, b.get(runId))) return false;
  }
  return true;
}

export function runContextGrowthLabel(growth: RunContextGrowth): string {
  return growth.kind === "grew"
    ? `+${formatTokens(growth.tokens)} context`
    : `context reset to ${formatTokens(growth.usedTokens)}`;
}
