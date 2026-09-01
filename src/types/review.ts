import type { DiffLine } from "@/utils/diff";

export interface ReviewSummaryProposal {
  docId: string | number | null;
  docLabel: string;
  originalMarkdown: string;
  proposedMarkdown: string;
  diffLines: DiffLine[];
}

export interface ReviewDocUpdate {
  docId: string | number | null;
  docSlug: string;
  docLabel: string;
  folderPath: string;
  /** File paths in the PR that contributed to this doc update */
  files: string[];
  originalMarkdown: string;
  proposedMarkdown: string;
  diffLines: DiffLine[];
}

/** Security metadata attached to a review request when suspicious inputs are detected. */
export interface ReviewSecurityMetadata {
  suspiciousInputDetected: boolean;
  detectedAt: string;
  /** Human-readable patterns that triggered the flag, for auditing. */
  matchedPatterns: string[];
}

export interface ReviewRequestPayload {
  reviewId: string;
  organizationId: string;
  status: "pending" | "accepted" | "rejected";
  diffUrls: string[];
  summary: ReviewSummaryProposal;
  updates: ReviewDocUpdate[];
  metadata: {
    title: string;
    description: string;
    /** Present only when the injection detector fired on this changeset's inputs. */
    security?: ReviewSecurityMetadata;
  };
}
