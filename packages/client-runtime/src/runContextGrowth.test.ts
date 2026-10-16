import {
  type OrchestrationV2ProviderTurn,
  ProviderThreadId,
  RunAttemptId,
  RunId,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { deriveRunContextGrowth, runContextGrowthLabel } from "./runContextGrowth.ts";

type RunStatus = "completed" | "interrupted" | "rolled_back" | "running";

interface TurnSpec {
  readonly run: string;
  readonly used?: number;
  readonly runStatus?: RunStatus;
  readonly status?: OrchestrationV2ProviderTurn["status"];
  readonly thread?: string;
  readonly ordinal?: number;
}

function projectionOf(turns: ReadonlyArray<TurnSpec>) {
  const ordinals = new Map<string, number>();
  const runs = new Map<string, RunStatus>();
  const providerTurns = turns.map((turn) => {
    const thread = turn.thread ?? "main";
    const ordinal = turn.ordinal ?? (ordinals.get(thread) ?? 0) + 1;
    ordinals.set(thread, ordinal);
    runs.set(turn.run, turn.runStatus ?? "completed");
    return {
      providerThreadId: ProviderThreadId.make(thread),
      runAttemptId: RunAttemptId.make(`attempt:${turn.run}`),
      ordinal,
      status: turn.status ?? "completed",
      ...(turn.used === undefined
        ? {}
        : { tokenUsage: { usedTokens: turn.used, updatedAt: "2026-10-16T00:00:00.000Z" } }),
    };
  });
  return {
    runs: [...runs].map(([id, status]) => ({ id: RunId.make(id), status })),
    attempts: [...runs.keys()].map((id) => ({
      id: RunAttemptId.make(`attempt:${id}`),
      runId: RunId.make(id),
    })),
    providerTurns,
  };
}

function growthOf(turns: ReadonlyArray<TurnSpec>) {
  return Object.fromEntries(
    [...deriveRunContextGrowth(projectionOf(turns))].map(([runId, growth]) => [runId, growth]),
  );
}

describe("deriveRunContextGrowth", () => {
  it("measures each run against the turn before it, starting from empty", () => {
    expect(
      growthOf([
        { run: "a", used: 20_000 },
        { run: "b", used: 23_500 },
      ]),
    ).toEqual({
      a: { kind: "grew", tokens: 20_000 },
      b: { kind: "grew", tokens: 3_500 },
    });
  });

  it("adds up every provider turn of a run", () => {
    expect(
      growthOf([
        { run: "a", used: 10_000 },
        { run: "b", used: 12_000 },
        { run: "b", used: 15_000 },
      ]).b,
    ).toEqual({ kind: "grew", tokens: 5_000 });
  });

  it("measures the turn after a rewind from the rollback target", () => {
    expect(
      growthOf([
        { run: "a", used: 114_809 },
        { run: "b", used: 121_832, runStatus: "rolled_back" },
        { run: "c", used: 118_746 },
      ]),
    ).toEqual({
      a: { kind: "grew", tokens: 114_809 },
      c: { kind: "grew", tokens: 3_937 },
    });
  });

  it("reports the remaining size when a run shrinks the context", () => {
    expect(
      growthOf([
        { run: "a", used: 180_000 },
        { run: "b", used: 48_000 },
        { run: "b", used: 52_000 },
      ]).b,
    ).toEqual({ kind: "shrank", usedTokens: 52_000 });
  });

  it("leaves out runs without a measured predecessor", () => {
    expect(
      growthOf([
        { run: "a", used: 40_000, ordinal: 4 },
        { run: "b", used: 42_000 },
        { run: "c", runStatus: "interrupted", status: "interrupted" },
        { run: "d", used: 50_000 },
      ]),
    ).toEqual({ b: { kind: "grew", tokens: 2_000 } });
  });

  it("waits for a running turn to settle", () => {
    expect(
      growthOf([
        { run: "a", used: 10_000 },
        { run: "b", used: 11_000, runStatus: "running", status: "running" },
      ]),
    ).toEqual({ a: { kind: "grew", tokens: 10_000 } });
  });
});

describe("runContextGrowthLabel", () => {
  it("formats growth and resets", () => {
    expect(runContextGrowthLabel({ kind: "grew", tokens: 43_653 })).toBe("+43.7K context");
    expect(runContextGrowthLabel({ kind: "shrank", usedTokens: 48_000 })).toBe(
      "context reset to 48K",
    );
  });
});
