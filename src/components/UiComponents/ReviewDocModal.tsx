
import { useEffect, useState } from "react";
import Modal from "./Modal";
import ReviewDiffViewer from "./ReviewDiffViewer";
import ReviewMarkdownPreview from "./ReviewMarkdownPreview";
import { useDocStore } from "@/store/useDocStore";
import { toast } from "sonner";
import type { ReviewRequestPayload } from "@/types/review";

interface ReviewDocModalProps {
  onReviewApplied?: (result: {
    summaryDocId: string | number | null;
    updated: Array<{ docId: string | number | null; docLabel: string; filesUpdated: number }>;
  }) => Promise<void> | void;
  onReviewRejected?: () => void;
}

export default function ReviewDocModal({
  onReviewApplied,
  onReviewRejected,
}: ReviewDocModalProps) {
  const pendingReview = useDocStore((state) => state.pendingReviewRequest);
  const setPendingReviewRequest = useDocStore(
    (state) => state.setPendingReviewRequest,
  );
  const [selectedReviewIndex, setSelectedReviewIndex] = useState(0);
  const [reviewViewMode, setReviewViewMode] = useState<"diff" | "preview">(
    "diff",
  );
  const [actionState, setActionState] = useState<"idle" | "accepting" | "rejecting">(
    "idle",
  );

  /** Mirrors doc-resolver.ts resolveTargetFolderPath — keeps client in sync with server. */
  function resolveSidebarPath(folderPath: string): string {
    if (folderPath === "Changeset Summary" || folderPath === "Guides") {
      return `${folderPath}`;
    }
    const base = folderPath ? `Code Reference/${folderPath}` : "Code Reference";
    return `${base}`;
  }

  const reviewItems = pendingReview
    ? [
      {
        key: "summary",
        title: pendingReview.summary.docLabel,
        docPath: "Changeset Summary",
        diffLines: pendingReview.summary.diffLines,
        originalMarkdown: pendingReview.summary.originalMarkdown,
        proposedMarkdown: pendingReview.summary.proposedMarkdown,
      },
      ...pendingReview.updates.map((update) => ({
        key: update.docSlug,
        title: update.docLabel,
        docPath: resolveSidebarPath(update.folderPath),
        diffLines: update.diffLines,
        originalMarkdown: update.originalMarkdown,
        proposedMarkdown: update.proposedMarkdown,
      })),
    ]
    : [];

  const selectedReviewItem = reviewItems[selectedReviewIndex] || reviewItems[0] || null;

  useEffect(() => {
    if (pendingReview && selectedReviewIndex >= reviewItems.length) {
      setSelectedReviewIndex(0);
    }
  }, [pendingReview, reviewItems.length, selectedReviewIndex]);

  const closeDialog = () => {
    if (actionState !== "idle") return;
    setPendingReviewRequest(null);
  };

  const handleAccept = async () => {
    if (!pendingReview) return;
    setActionState("accepting");

    try {
      const response = await fetch(`/api/review-doc/${pendingReview.reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to apply proposed changes.");
      }

      toast.success("Proposed changes accepted and applied.");
      setPendingReviewRequest(null);
      await onReviewApplied?.(result);
    } catch (error: any) {
      toast.error(error?.message || "Failed to apply proposed changes.");
      console.error("Review accept error:", error);
    } finally {
      setActionState("idle");
    }
  };

  const handleReject = async () => {
    if (!pendingReview) return;
    setActionState("rejecting");

    try {
      const response = await fetch(`/api/review-doc/${pendingReview.reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to reject proposed changes.");
      }

      toast.success("Proposed changes rejected.");
      setPendingReviewRequest(null);
      onReviewRejected?.();
    } catch (error: any) {
      toast.error(error?.message || "Failed to reject proposed changes.");
      console.error("Review reject error:", error);
    } finally {
      setActionState("idle");
    }
  };

  return (
    <Modal
      isOpen={!!pendingReview}
      onClose={closeDialog}
      showCloseButton={actionState === "idle"}
      title="Review Generated Changes"
      modalClass="max-w-5xl lg:max-w-6xl"
      headerRight={
        pendingReview ? (
          <div className="flex items-center gap-2">
            {actionState !== "accepting" && (
              <button
                type="button"
                onClick={handleReject}
                disabled={actionState !== "idle"}
                className="rounded-lg bg-border text-textSecondary hover:bg-opacity-90 px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
              >
                {actionState === "rejecting" ? "Rejecting…" : "Reject"}
              </button>
            )}
            {actionState !== "rejecting" && (
              <button
                type="button"
                onClick={handleAccept}
                disabled={actionState !== "idle"}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-textPrimary hover:bg-primary/90 transition disabled:opacity-50"
              >
                {actionState === "accepting" ? "Applying…" : "Accept Changes"}
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      {pendingReview ? (
        <div className="flex flex-col gap-4 flex-1 min-h-0">

          {/* Security Warning Banner — shown when injection detector fired */}
          {pendingReview.metadata?.security?.suspiciousInputDetected && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 shrink-0">
              <span className="mt-0.5 shrink-0 text-base">⚠️</span>
              <div>
                <p className="font-semibold">Security Notice: Suspicious Input Detected</p>
                <p className="mt-0.5 text-amber-300/80">
                  This changeset contains patterns that may indicate a prompt injection attempt.
                  Review the proposed changes carefully before accepting.
                </p>
              </div>
            </div>
          )}

          {/* Two-column layout — each column scrolls independently */}
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] flex-1 min-h-0">

            {/* Left: file list — independently scrollable */}
            <div className="overflow-y-auto min-h-0 pr-1 space-y-1">
              {reviewItems.map((item, index) => {
                const isNew = item.originalMarkdown === "";
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedReviewIndex(index)}
                    className={`w-full text-left rounded-md p-3 group/review-item transition-all duration-200 ${selectedReviewIndex === index
                      ? "bg-border/50 text-primary"
                      : "text-textSecondary hover:bg-border/40 hover:text-textPrimary"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-snug flex-1 min-w-0">
                        {item.title}
                      </p>
                      {isNew && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-textPrimary border border-primary">
                          New
                        </span>
                      )}
                    </div>
                    {item.docPath ? (
                      <p
                        className={`text-[10px] truncate mt-1.5 transition-colors ${selectedReviewIndex === index
                          ? "text-primary/70"
                          : "text-textMuted group-hover/review-item:text-textSecondary"
                          }`}
                        title={item.docPath}
                      >
                        {item.docPath}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Right: diff / preview — independently scrollable */}
            <div className="relative flex min-h-0 min-w-0">
              <div className="overflow-y-auto min-h-0 flex-1 pr-2 custom-scrollbar">
                <div className="rounded-3xl border border-border bg-secondaryBg p-4">
                  {/* Sticky header row: title + Diff/Preview toggle */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-textSecondary">Current review target</p>
                      <p className="text-lg font-semibold text-textPrimary">
                        {selectedReviewItem?.title}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewViewMode("diff")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${reviewViewMode === "diff"
                          ? "bg-primary text-textPrimary"
                          : "bg-secondaryBg text-textSecondary border border-border hover:bg-border"
                          }`}
                      >
                        Diff
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewViewMode("preview")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${reviewViewMode === "preview"
                          ? "bg-primary text-textPrimary"
                          : "bg-secondaryBg text-textSecondary border border-border hover:bg-border"
                          }`}
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    {reviewViewMode === "preview" ? (
                      <ReviewMarkdownPreview
                        markdown={selectedReviewItem?.proposedMarkdown ?? ""}
                      />
                    ) : (
                      <ReviewDiffViewer diff={selectedReviewItem?.diffLines ?? []} />
                    )}
                  </div>
                </div>
              </div>

              {/* GitHub-like change position indicator track */}
              {reviewViewMode === "diff" && selectedReviewItem?.diffLines && selectedReviewItem.diffLines.length > 0 && (
                <div className="w-2 ml-1 relative bg-border/20 rounded-full overflow-hidden shrink-0">
                  {selectedReviewItem.diffLines.map((line, i) => {
                    if (line.type === "unchanged") return null;
                    const top = `${(i / selectedReviewItem.diffLines.length) * 100}%`;
                    return (
                      <div
                        key={i}
                        className={`absolute w-full h-[2px] opacity-70 ${
                          line.type === "added" ? "bg-emerald-500" : "bg-red-500"
                        }`}
                        style={{ top }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

          </div> {/* end grid */}
        </div>
      ) : null}
    </Modal>
  );
}
