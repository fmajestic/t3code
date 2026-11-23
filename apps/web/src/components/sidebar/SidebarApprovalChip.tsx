import { useGT } from "gt-react";
import { ShieldQuestionIcon } from "lucide-react";

/** How many threads a closed folder or section hides that wait on an approval. */
export function SidebarApprovalChip(props: { count: number }) {
  const gt = useGT();
  return (
    <span className="inline-flex h-4.5 shrink-0 items-center gap-0.5 rounded-full bg-approval px-1.5 text-xs font-semibold text-white tabular-nums">
      <ShieldQuestionIcon aria-hidden className="size-3" />
      <span aria-hidden>{props.count}</span>
      <span className="sr-only">
        {gt("{count, plural, one {{count} thread awaits} other {{count} threads await}} approval", {
          count: props.count,
        })}
      </span>
    </span>
  );
}
