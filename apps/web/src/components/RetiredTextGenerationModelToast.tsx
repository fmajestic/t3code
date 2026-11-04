import type { EnvironmentId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useEnvironmentSettings } from "../hooks/useSettings";
import { retiredTextGenerationModel } from "../modelSelection";
import { useEnvironmentProviders, useEnvironments } from "../state/environments";
import { toastManager } from "./ui/toast";

const NO_PROVIDERS = [] as const;

export function RetiredTextGenerationModelToast() {
  const { environments } = useEnvironments();
  return environments.map((environment) => (
    <EnvironmentRetiredModelToast
      key={environment.environmentId}
      environmentId={environment.environmentId}
    />
  ));
}

function EnvironmentRetiredModelToast({ environmentId }: { environmentId: EnvironmentId }) {
  const navigate = useNavigate();
  const settings = useEnvironmentSettings(environmentId);
  const providers = useEnvironmentProviders().get(environmentId) ?? NO_PROVIDERS;
  const retired = retiredTextGenerationModel(settings, providers);
  const checkedAt = providers.find(
    (provider) => provider.instanceId === settings.textGenerationModelSelection?.instanceId,
  )?.checkedAt;
  const shownFor = useRef<string | null>(null);
  // One check pushes several snapshots; a toast still on screen covers them all.
  const open = useRef(false);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- raises an imperative toast for each provider check that finds the model retired
  useEffect(() => {
    const key = retired === null ? null : `${retired}:${checkedAt}`;
    if (key === null || key === shownFor.current) return;
    shownFor.current = key;
    if (open.current) return;
    open.current = true;
    toastManager.add({
      type: "warning",
      title: "Text model retired",
      description: `${retired} is no longer offered, so a fallback is used.`,
      onRemove: () => {
        open.current = false;
      },
      actionProps: {
        children: "Change",
        onClick: () => {
          void navigate({
            to: "/settings/threads",
            search: { machine: environmentId },
            hash: "text-generation-model",
          });
        },
      },
    });
  }, [retired, checkedAt, navigate, environmentId]);

  return null;
}
