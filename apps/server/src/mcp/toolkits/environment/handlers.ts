import {
  OrchestratorMcpFailure,
  type ServerSettings,
  type SidebarSectionSetting,
  sectionThreadTag,
  validateSectionName,
} from "@t3tools/contracts";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Environment from "../../../environment/ServerEnvironment.ts";
import * as ThreadCommandExecutor from "../../../orchestration-v2/ThreadCommandExecutor.ts";
import * as Settings from "../../../serverSettings.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { dispatchFailure, newCommandId, readCaller, unavailable } from "../../threadAccess.ts";
import { EnvironmentToolkit } from "./tools.ts";

export function preferences(settings: ServerSettings) {
  const {
    defaultThreadEnvMode,
    newWorktreesStartFromOrigin,
    enableProviderUpdateChecks,
    backgroundActivity,
    sourceControlWritingStyle,
  } = settings;
  const characters = Array.from(sourceControlWritingStyle.customInstructions);
  return {
    defaultThreadEnvMode,
    newWorktreesStartFromOrigin,
    enableProviderUpdateChecks,
    backgroundActivity: { profile: backgroundActivity.profile },
    sourceControlWritingStyle: {
      ...sourceControlWritingStyle,
      customInstructions: characters.slice(0, 4000).join(""),
      truncated: characters.length > 4000,
    },
  };
}
const invalid = (message: string) =>
  new OrchestratorMcpFailure({ code: "invalid_request", message });

const missingSection = (sectionId: string) =>
  invalid(`No sidebar section has id ${sectionId}. List them with t3_sidebar_section.`);

export const requireSection = (
  sections: ReadonlyArray<SidebarSectionSetting>,
  sectionId: string,
) =>
  sections.some((section) => section.id === sectionId)
    ? Effect.void
    : Effect.fail(missingSection(sectionId));

const required = <A>(value: A | undefined, name: string) =>
  value === undefined
    ? Effect.fail(invalid(`This action needs \`${name}\`.`))
    : Effect.succeed(value);

/** `sections` with `moved` placed before `beforeId`, or last for null. */
function placeSection(
  sections: ReadonlyArray<SidebarSectionSetting>,
  moved: SidebarSectionSetting,
  beforeId: string | null,
) {
  if (beforeId === moved.id) return sections;
  const rest = sections.filter((section) => section.id !== moved.id);
  const index = beforeId === null ? -1 : rest.findIndex((section) => section.id === beforeId);
  return index === -1 ? [...rest, moved] : [...rest.slice(0, index), moved, ...rest.slice(index)];
}

const editSections = Effect.fn("mcp.editSidebarSections")(function* (
  sections: ReadonlyArray<SidebarSectionSetting>,
  input: {
    readonly action: "list" | "create" | "rename" | "delete" | "reorder";
    readonly sectionId?: string | undefined;
    readonly name?: string | undefined;
    readonly beforeSectionId?: string | null | undefined;
  },
) {
  const placeBefore = (beforeId: string | null | undefined) =>
    beforeId === undefined || beforeId === null
      ? Effect.succeed(null)
      : requireSection(sections, beforeId).pipe(Effect.as(beforeId));
  const validName = (name: string, renamingId: string | null) => {
    const validated = validateSectionName(name, sections, renamingId);
    return "error" in validated
      ? Effect.fail(invalid(validated.error))
      : Effect.succeed(validated.name);
  };
  if (input.action === "create") {
    const name = yield* validName(yield* required(input.name, "name"), null);
    const beforeId = yield* placeBefore(input.beforeSectionId);
    const random = yield* SecureRandom.SecureRandom;
    const section = { id: yield* random.uuidV4(), name };
    return { sections: placeSection(sections, section, beforeId), sectionId: section.id };
  }
  const sectionId = yield* required(input.sectionId, "sectionId");
  const section = sections.find((candidate) => candidate.id === sectionId);
  if (section === undefined) return yield* missingSection(sectionId);
  switch (input.action) {
    case "rename": {
      const name = yield* validName(yield* required(input.name, "name"), sectionId);
      return {
        sections: sections.map((candidate) =>
          candidate.id === sectionId ? { ...candidate, name } : candidate,
        ),
      };
    }
    case "reorder": {
      const beforeId = yield* placeBefore(
        yield* required(input.beforeSectionId, "beforeSectionId"),
      );
      return { sections: placeSection(sections, section, beforeId) };
    }
    case "delete":
      return { sections: sections.filter((candidate) => candidate.id !== sectionId) };
    case "list":
      return { sections };
  }
});

const unfileSection = Effect.fn("mcp.unfileSidebarSection")(function* (sectionId: string) {
  const { threads } = yield* readCaller();
  const tag = sectionThreadTag(sectionId);
  const members = yield* threads
    .listProjectThreads({ includeSubagents: true })
    .pipe(Effect.mapError(unavailable));
  for (const thread of members) {
    if (thread.tags?.includes(tag) !== true) continue;
    yield* threads
      .dispatch({
        type: "thread.tag.set",
        commandId: yield* newCommandId(),
        threadId: thread.id,
        tag,
        tagged: false,
      })
      .pipe(Effect.mapError(dispatchFailure));
  }
});

const access = Effect.gen(function* () {
  const context = yield* readCaller();
  const environment = yield* Environment.ServerEnvironment;
  const descriptor = yield* environment.getDescriptor;
  if (descriptor.environmentId !== context.scope.environmentId)
    return yield* new OrchestratorMcpFailure({
      code: "capability_denied",
      message: "This credential belongs to another environment.",
    });
  return { ...context, descriptor, settings: yield* Settings.ServerSettingsService };
});
const underCallerLock = Effect.fn("mcp.underCallerLock")(function* <A, E, R>(
  update: Effect.Effect<A, E, R>,
) {
  const scope = yield* McpInvocationContext.McpInvocationContext;
  const executor = yield* ThreadCommandExecutor.ThreadCommandExecutor;
  return yield* scope.thread === undefined
    ? update
    : executor.withLock(scope.thread.threadId, update);
});

export const layer = McpToolAccess.toLayer(EnvironmentToolkit, {
  t3_environment_read: McpToolAccess.reads(() =>
    Effect.gen(function* () {
      const { descriptor, settings } = yield* access;
      const current = yield* settings.getSettings.pipe(Effect.mapError(unavailable));
      return {
        environmentId: descriptor.environmentId,
        label: descriptor.label,
        serverVersion: descriptor.serverVersion,
        platform: descriptor.platform,
        preferences: preferences(current),
      };
    }),
  ),
  t3_environment_preferences_update: McpToolAccess.writesEnvironment((patch, check) =>
    underCallerLock(
      Effect.gen(function* () {
        // The turn may have ended, or the thread's modes changed, while this waited for the lock.
        yield* check;
        const { settings } = yield* access;
        return preferences(
          yield* settings.updateSettings(patch).pipe(Effect.mapError(unavailable)),
        );
      }),
    ),
  ),
  t3_sidebar_section: McpToolAccess.either(
    (input) => input.action === "list",
    McpToolAccess.reads(() =>
      Effect.gen(function* () {
        const { settings } = yield* access;
        const current = yield* settings.getSettings.pipe(Effect.mapError(unavailable));
        return { sections: current.sidebarSections };
      }),
    ),
    McpToolAccess.writesEnvironment((input, check) =>
      Effect.gen(function* () {
        const saved = yield* underCallerLock(
          Effect.gen(function* () {
            yield* check;
            const { settings } = yield* access;
            const current = yield* settings.getSettings.pipe(Effect.mapError(unavailable));
            const next = yield* editSections(current.sidebarSections, input);
            const written = yield* settings
              .updateSettings({ sidebarSections: next.sections })
              .pipe(Effect.mapError(unavailable));
            return { ...next, sections: written.sidebarSections };
          }),
        );
        // Outside the caller's lock: dispatch takes each thread's lock, the caller's too.
        if (input.action === "delete" && input.sectionId !== undefined) {
          yield* unfileSection(input.sectionId);
        }
        return saved;
      }),
    ),
  ),
});
