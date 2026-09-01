import type { DiffLine } from "@/utils/diff";

interface ReviewDiffViewerProps {
  diff: DiffLine[];
}

export default function ReviewDiffViewer({ diff }: ReviewDiffViewerProps) {
  return (
    <div className="rounded-2xl border border-border bg-gray-950/40 p-4 overflow-x-auto">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-textSecondary">
        <span>Diff preview</span>
        <span>{diff.length} lines</span>
      </div>
      <div className="space-y-0.5 text-[0.93rem] font-mono leading-5">
        {diff.map((line, index) => {
          const commonClasses =
            "whitespace-pre-wrap rounded-md px-2 py-1 overflow-hidden";
          const linePrefix =
            line.type === "added"
              ? "+"
              : line.type === "removed"
              ? "-"
              : " ";
          const lineClass =
            line.type === "added"
              ? "bg-emerald-500/10 text-emerald-300"
              : line.type === "removed"
              ? "bg-red-500/10 text-red-300"
              : "bg-transparent text-textSecondary";

          return (
            <div
              key={`${index}-${line.type}-${line.text.slice(0, 20)}`}
              className={`${commonClasses} ${lineClass} flex gap-3`}
            >
              <span className="text-textSecondary w-6 text-right tabular-nums">
                {linePrefix}
              </span>
              <span className="flex-1 break-words">{line.text || "\u00A0"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
