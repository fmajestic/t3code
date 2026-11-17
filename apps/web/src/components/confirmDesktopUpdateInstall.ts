import type { DesktopUpdateState } from "@t3tools/contracts";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import * as DateTime from "effect/DateTime";

import { ensureLocalApi } from "../localApi";
import { appAtomRegistry } from "../rpc/atomRegistry";
import { readProject } from "../state/entities";
import { primaryEnvironmentIdAtom } from "../state/primaryEnvironment";
import { primaryServerSettingsAtom } from "../state/server";
import { environmentThreadShells } from "../state/threads";
import { type InterruptedThread, getDesktopUpdateInstallConfirmation } from "./desktopUpdate.logic";

const INTERRUPTIBLE_STATUSES = new Set(["preparing", "starting", "running", "waiting"]);

function readLocalInterruptedThreads(): InterruptedThread[] {
  const environmentId = appAtomRegistry.get(primaryEnvironmentIdAtom);
  if (environmentId === null) return [];
  const settings = appAtomRegistry.get(primaryServerSettingsAtom);
  return appAtomRegistry
    .get(environmentThreadShells.environmentThreadsAtom(environmentId))
    .filter((thread) => INTERRUPTIBLE_STATUSES.has(thread.status))
    .map((thread) => {
      const startedAt = thread.activityRunStartedAt ?? thread.latestRunStartedAt ?? null;
      const request = thread.pendingRuntimeRequest;
      return {
        title: thread.title,
        project: readProject(scopeProjectRef(environmentId, thread.projectId))?.title ?? null,
        startedAt: startedAt === null ? null : DateTime.formatIso(startedAt),
        // A non-blocking question lets the agent keep working.
        needsUser: request !== null && request.blocking !== false,
        continues: resolveProjectSettings(settings, thread.projectId).settings
          .continueThreadsAfterServerUpdate,
      };
    });
}

export function confirmDesktopUpdateInstall(
  state: Pick<DesktopUpdateState, "availableVersion" | "downloadedVersion">,
): Promise<boolean> {
  const { message, options } = getDesktopUpdateInstallConfirmation(
    state,
    readLocalInterruptedThreads(),
  );
  return ensureLocalApi().dialogs.confirm(message, options);
}
