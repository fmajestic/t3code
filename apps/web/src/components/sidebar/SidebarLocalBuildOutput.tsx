export function SidebarLocalBuildOutput({
  lines,
  tooltip,
}: {
  readonly lines: ReadonlyArray<string>;
  readonly tooltip: string;
}) {
  return (
    <div className="flex w-[min(32rem,calc(100vw-2rem))] flex-col px-1 py-1 text-left">
      <div className="text-sm leading-5 font-medium">{tooltip}</div>
      {/* Fixed height, newest line at the bottom, so 4 Hz updates never resize the popover. */}
      <div className="mt-2 flex h-67 flex-col justify-end overflow-x-auto overflow-y-hidden rounded-md bg-black/25 py-1.5 font-mono text-2xs leading-4 text-popover-foreground/85">
        {/* One wrapper as wide as the longest line, so all lines scroll together. */}
        <div className="w-max min-w-full px-2">
          {lines.map((line, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- lines repeat, so the index is the identity
            <div key={index} className="whitespace-pre">
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
