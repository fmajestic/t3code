import { msg, T, useMessages } from "gt-react";
import { CheckIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import {
  completeConfirmDialogClose,
  readConfirmDialogState,
  respondToConfirmDialog,
  subscribeConfirmDialogHost,
} from "../confirmDialog";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogAction,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useInlineActionConfirm } from "../hooks/useInlineActionConfirm";
import { cn } from "../lib/utils";
import { AnimatedWidth } from "./AnimatedWidth";
import { Button } from "./ui/button";
import type { MessageResolver } from "../i18n/messages";

type ConfirmationCopy = {
  readonly title: string;
  readonly description: string | null;
};

// LocalApi.confirm takes one string; translated questions may end in a full-width mark.
const QUESTION_MARK = /[?？]/;

function resolveConfirmDialogCopy(message: string, resolve: MessageResolver): ConfirmationCopy {
  const normalizedMessage = message.trim();
  const lines = normalizedMessage.split("\n");
  const questionLineIndex = lines.findIndex((line) => QUESTION_MARK.test(line.trim().slice(-1)));

  if (questionLineIndex >= 0) {
    const title = lines[questionLineIndex]!.trim();
    const description = lines
      .filter((_, index) => index !== questionLineIndex)
      .join("\n")
      .trim();
    return { title, description: description || null };
  }

  const questionMarkIndex = normalizedMessage.search(QUESTION_MARK);
  if (questionMarkIndex >= 0) {
    return {
      title: normalizedMessage.slice(0, questionMarkIndex + 1).trim(),
      description: normalizedMessage.slice(questionMarkIndex + 1).trim() || null,
    };
  }

  return {
    title: resolve(msg("Confirm action")),
    description: normalizedMessage || resolve(msg("This action requires your confirmation.")),
  };
}

export function ConfirmDialogHost() {
  const m = useMessages();
  const state = useSyncExternalStore(
    subscribeConfirmDialogHost,
    readConfirmDialogState,
    readConfirmDialogState,
  );

  const copy = resolveConfirmDialogCopy(state.status === "idle" ? "" : state.message, m);
  const options = state.status === "idle" ? {} : state.options;
  const confirmVariant = options.variant ?? "default";
  const confirmLabel = options.confirmLabel ?? m(msg("Confirm"));
  const armedLabel = options.armedConfirmLabel;
  const focusConfirm = options.initialFocus === "confirm";
  const onCancel = () => respondToConfirmDialog(false);
  const onConfirm = () => respondToConfirmDialog(true);
  // Each prompt is its own scope, so an armed Confirm never carries over to the next one.
  const inlineConfirm = useInlineActionConfirm(state.status === "idle" ? "" : state.message);
  const armed = inlineConfirm.isArmed("confirm");

  return (
    <AlertDialog
      open={state.status === "confirming"}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      onOpenChangeComplete={(open) => {
        if (!open) completeConfirmDialogClose();
      }}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          {copy.description ? (
            <AlertDialogDescription className="whitespace-pre-line">
              {copy.description}
            </AlertDialogDescription>
          ) : null}
          {options.affected?.map((group) => (
            <div
              key={group.label}
              className="mt-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-left text-sm"
            >
              <p className="font-medium text-foreground">{group.label}</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {group.items.map((item, index) => (
                  // oxlint-disable-next-line react/no-array-index-key -- items are display text and may repeat
                  <li key={index} className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        group.tone === "warning" ? "bg-warning" : "bg-info",
                      )}
                    />
                    <span className="min-w-0 truncate text-foreground/90">{item.title}</span>
                    {item.detail ? (
                      <span className="ml-auto shrink-0 pl-2 text-muted-foreground text-xs">
                        {item.detail}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {group.note ? (
                <p className="mt-2 text-muted-foreground text-xs">{group.note}</p>
              ) : null}
            </div>
          ))}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>
            <T>Cancel</T>
          </AlertDialogClose>
          {armedLabel !== undefined ? (
            <Button
              variant={confirmVariant}
              aria-label={armed ? armedLabel : confirmLabel}
              {...inlineConfirm.props("confirm", onConfirm)}
            >
              <AnimatedWidth>
                <span className="inline-flex items-center gap-2">
                  {armed ? <CheckIcon aria-hidden className="size-4" /> : null}
                  {armed ? armedLabel : confirmLabel}
                </span>
              </AnimatedWidth>
            </Button>
          ) : focusConfirm && confirmVariant === "default" ? (
            <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
          ) : (
            <Button variant={confirmVariant} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
