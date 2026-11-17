import { describe, expect, it } from "vite-plus/test";
import type { DesktopUpdateState } from "@t3tools/contracts";

import {
  canCheckForUpdate,
  getDesktopUpdateButtonTooltip,
  getDesktopUpdateReleaseHistoryUrl,
  getDesktopUpdateReleaseUrl,
  resolveDesktopUpdateButtonAction,
  getDesktopUpdateInstallConfirmation,
} from "./desktopUpdate.logic";

const baseState: DesktopUpdateState = {
  enabled: true,
  status: "idle",
  channel: "latest",
  currentVersion: "1.0.0",
  hostArch: "x64",
  appArch: "x64",
  runningUnderArm64Translation: false,
  availableVersion: null,
  downloadedVersion: null,
  releaseNotes: [],
  omittedReleaseCount: 0,
  downloadPercent: null,
  checkedAt: null,
  message: null,
  errorContext: null,
  canRetry: false,
};

describe("desktop update button state", () => {
  it("keeps retry action available after a download error", () => {
    const state: DesktopUpdateState = {
      ...baseState,
      status: "error",
      availableVersion: "1.1.0",
      message: "network timeout",
      errorContext: "download",
      canRetry: true,
    };
    expect(resolveDesktopUpdateButtonAction(state)).toBe("download");
    expect(getDesktopUpdateButtonTooltip(state)).toContain("Click to retry");
  });

  it("shows the download failure after returning to available", () => {
    const state: DesktopUpdateState = {
      ...baseState,
      status: "available",
      availableVersion: "1.1.0",
      message: "network timeout",
      errorContext: "download",
      canRetry: true,
    };
    expect(resolveDesktopUpdateButtonAction(state)).toBe("download");
    expect(getDesktopUpdateButtonTooltip(state)).toBe("Download failed for 1.1.0. Click to retry.");
    expect(getDesktopUpdateButtonTooltip({ ...state, notAppliedVersion: "1.1.0" })).toBe(
      "Update 1.1.0 did not apply. Click to retry.",
    );
  });

  it("never calls a build on the other track up to date", () => {
    // A Stable build whose switch to Nightly did not finish; the updater discards every release.
    const state: DesktopUpdateState = {
      ...baseState,
      status: "up-to-date",
      channel: "nightly",
      currentVersion: "0.1.5",
      checkedAt: "2026-11-18T00:00:00.000Z",
    };
    expect(getDesktopUpdateButtonTooltip(state)).not.toBe("Up to date");
    expect(
      getDesktopUpdateButtonTooltip({ ...state, currentVersion: "0.1.6-nightly.20261118.1" }),
    ).toBe("Up to date");
  });

  it("says a local build was built, not downloaded", () => {
    const state: DesktopUpdateState = {
      ...baseState,
      localBuild: true,
      status: "downloaded",
      availableVersion: "abc1234",
      downloadedVersion: "0.0.46-fork.1",
    };
    expect(getDesktopUpdateButtonTooltip(state)).toBe(
      "Update 0.0.46-fork.1 built. Click to restart and install.",
    );
    expect(
      getDesktopUpdateButtonTooltip({ ...state, status: "error", errorContext: "check" }),
    ).toBe("Update 0.0.46-fork.1 built. Click to restart and install.");
    expect(
      getDesktopUpdateButtonTooltip({ ...state, status: "error", errorContext: "install" }),
    ).toBe("Install failed for 0.0.46-fork.1. Click to retry.");
  });

  it("prefers a newly available release over a stale downloaded version", () => {
    const state: DesktopUpdateState = {
      ...baseState,
      status: "available",
      availableVersion: "1.2.0",
      downloadedVersion: "1.1.0",
    };
    expect(resolveDesktopUpdateButtonAction(state)).toBe("download");
  });

  it("hides the install action while checking for a newer release", () => {
    const state: DesktopUpdateState = {
      ...baseState,
      status: "checking",
      availableVersion: "1.1.0",
      downloadedVersion: "1.1.0",
      downloadPercent: 100,
    };
    expect(resolveDesktopUpdateButtonAction(state)).toBe("none");
  });
});

describe("desktop update UI helpers", () => {
  it.each(["owner/repo/extra", "owner#notes/repo", "owner/repo?tab=notes"])(
    "falls back to upstream for an invalid configured repository: %s",
    (repository) => {
      expect(getDesktopUpdateReleaseHistoryUrl(repository)).toBe(
        "https://github.com/pingdotgg/t3code/releases",
      );
      expect(getDesktopUpdateReleaseUrl("1.2.3", repository)).toBe(
        "https://github.com/pingdotgg/t3code/releases/tag/v1.2.3",
      );
    },
  );
});

describe("canCheckForUpdate", () => {
  it("returns true once an update has been downloaded so newer releases can be found", () => {
    expect(
      canCheckForUpdate({
        ...baseState,
        status: "downloaded",
        availableVersion: "1.1.0",
        downloadedVersion: "1.1.0",
      }),
    ).toBe(true);
  });
});

describe("getDesktopUpdateInstallConfirmation", () => {
  const state = { availableVersion: "1.2.0", downloadedVersion: "1.2.0" };
  const now = Date.parse("2026-11-17T12:00:00Z");
  const thread = (title: string, needsUser = false, continues = true) => ({
    title,
    project: "t3code",
    startedAt: "2026-11-17T11:48:00Z",
    needsUser,
    continues,
  });

  it("asks plainly and focuses Restart when no thread is running", () => {
    expect(getDesktopUpdateInstallConfirmation(state, [], now)).toEqual({
      message: "Restart T3 Code to install the update?\n1.2.0",
      options: { initialFocus: "confirm", confirmLabel: "Restart" },
    });
  });

  it("splits working threads from ones waiting on the user and caps each list", () => {
    const working = ["a", "b", "c", "d", "e", "f"].map((title) => thread(title));
    const { options } = getDesktopUpdateInstallConfirmation(
      state,
      [...working, thread("asks", true)],
      now,
    );
    expect(options.variant).toBe("destructive");
    expect(options.armedConfirmLabel).toBe("Interrupt and restart?");
    expect(options.affected?.map((group) => group.label)).toEqual([
      "Interrupts 6 threads at work",
      "Also stops 1 thread waiting on you",
    ]);
    expect(options.affected?.[0]?.items).toHaveLength(5);
    expect(options.affected?.[0]?.items[0]).toEqual({ title: "a", detail: "t3code · 12m" });
    expect(options.affected?.[1]?.items).toEqual([{ title: "asks", detail: "t3code" }]);
  });

  it.each([
    [[true, true], "They continue on their own after the restart."],
    [
      [false, false],
      "They won't continue after the restart. Settings › Maintenance › Continue threads after restarts.",
    ],
    [[true, false], "1 of 2 continue on their own after the restart, as their projects are set."],
  ])("notes whether working threads continue: %j", (continues, note) => {
    const threads = continues.map((value, index) => thread(`t${index}`, false, value));
    const { options } = getDesktopUpdateInstallConfirmation(state, threads, now);
    expect(options.affected?.[0]?.note).toBe(note);
  });

  it("needs one click when every thread is only waiting on the user", () => {
    const { options } = getDesktopUpdateInstallConfirmation(state, [thread("asks", true)], now);
    expect(options.variant).toBeUndefined();
    expect(options.armedConfirmLabel).toBeUndefined();
    expect(options.initialFocus).toBeUndefined();
  });
});
