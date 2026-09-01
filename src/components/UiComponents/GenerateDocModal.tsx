import { useState, useEffect, useRef } from "react";
import Modal from "./Modal";
import { useUser } from "@/app/core/auth/UserContext";
import { useDocStore } from "@/store/useDocStore";
/* Removed next/navigation */
import { toast } from "sonner";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import type { ReviewRequestPayload } from "@/types/review";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { isPlanLimitError } from "@/utils/plan-limit";
import Loader from "./Loader";

interface GenerateDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the raw API response data so callers can handle both
   * the legacy { documentation, metadata } shape and the new
   * mapping { updated, metadata } shape. */
  onSuccess: (data: any, validUrls: string[]) => void;
  onOpen: () => void;
  onPlanLimitReached?: (message?: string) => void;
  parentId?: number | string | null;
  isRegenerating?: boolean;
  initialUrls?: string[];
  autoStart?: boolean;
}

/** Extracts "owner/repo" (lowercased) from any GitHub URL, or null if not found. */
function extractRepoSlug(url: string): string | null {
  const match = url.toLowerCase().match(/github\.com\/([^\/]+\/[^\/]+)/);
  return match ? match[1].split("/").slice(0, 2).join("/") : null;
}

const GenerateDocModal = ({
  isOpen,
  onClose,
  onSuccess,
  onOpen,
  onPlanLimitReached,
  parentId = null,
  isRegenerating = false,
  initialUrls,
  autoStart = false,
}: GenerateDocModalProps) => {
  const [diffUrls, setDiffUrls] = useState<string[]>(
    initialUrls && initialUrls.length > 0 ? initialUrls : [""],
  );
  const { user, organization, refreshProfile } = useUser();
  const activeDoc = useDocStore((s) => s.activeDoc);
  const setGeneratingId = useDocStore((s) => s.setGeneratingId);
  const router = useRouter();
  const lastSyncedUrls = useRef<string[] | null>(null);

  const [bootstrapProgress, setBootstrapProgress] = useState<{
    current: number;
    total: number;
    module: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);


  // Sync initialUrls into state whenever the modal opens with new URLs
  useEffect(() => {
    if (isOpen && initialUrls && initialUrls.length > 0) {
      if (
        JSON.stringify(initialUrls) !== JSON.stringify(lastSyncedUrls.current)
      ) {
        setDiffUrls(initialUrls);
        lastSyncedUrls.current = initialUrls;
      }
    }
  }, [isOpen, initialUrls]);

  // Auto-start if requested
  useEffect(() => {
    if (isOpen && autoStart && initialUrls && initialUrls.length > 0) {
      // Short delay to ensure state is synced
      const timer = setTimeout(() => {
        handleGenerateDoc({ preventDefault: () => { } } as any);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoStart]);

  const handleClose = () => {
    if (bootstrapProgress || isGenerating) return; // Prevent closing while generating
    setDiffUrls([""]);
    lastSyncedUrls.current = null;
    onClose();
  };

  /**
   * Runs the bootstrap sequence (discover + generate-module loop) for a given
   * repo URL. Returns the number of successfully generated modules.
   */
  const runBootstrap = async (
    repoUrl: string,
    installationId: string | null | undefined,
    organizationId: string | null | undefined,
  ): Promise<{ successCount: number; totalModules: number }> => {
    setBootstrapProgress({
      current: 0,
      total: 1,
      module: "Discovering repository...",
    });

    // 1. Discover modules
    const discoverRes = await fetch("/api/bootstrap/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl, installationId, organizationId }),
    });

    let discoverData;
    const discoverText = await discoverRes.text();
    try {
      discoverData = JSON.parse(discoverText);
    } catch (e) {
      console.error("[runBootstrap] Failed to parse discover response:", discoverText);
      throw new Error("Discovery failed: Server returned an invalid response.");
    }

    if (!discoverRes.ok)
      throw new Error(discoverData.error || "Failed to discover repository");

    const modules = discoverData.modules || [];
    if (modules.length === 0) {
      toast.success(
        "Discovery complete, but no matching documentation modules were found.",
      );
      return { successCount: 0, totalModules: 0 };
    }

    // 2. Generate each module sequentially
    let successCount = 0;
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      setBootstrapProgress({
        current: i + 1,
        total: modules.length,
        module: mod.docLabel,
      });

      try {
        const genRes = await fetch("/api/bootstrap/generate-module", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoUrl,
            folderPath: mod.folderPath,
            docId: mod.docId,
            docLabel: mod.docLabel,
            docSlug: mod.docSlug,
            installationId,
            organizationId,
          }),
        });
        if (genRes.ok) {
          successCount++;
        } else {
          const errData = await genRes.json().catch(() => ({}));
          console.error(`Failed to generate module ${mod.docLabel}:`, errData.error || genRes.statusText);
        }
      } catch (e) {
        console.error(`Failed to generate module ${mod.docLabel}:`, e);
      }
    }

    return { successCount, totalModules: modules.length };
  };

  /**
   * Calls /api/organization/set-primary-repo and then refreshes the in-memory
   * organization context so that subsequent checks see the new primary_repo.
   */
  const setPrimaryRepo = async (
    orgId: string,
    repoSlug: string,
  ): Promise<void> => {
    setBootstrapProgress({
      current: 0,
      total: 1,
      module: "Setting primary repository...",
    });

    const repoUrl = `https://github.com/${repoSlug}`;
    const res = await fetch("/api/organization/set-primary-repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId,
        repoFullName: repoSlug,
        repoUrl,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { error: "Invalid response from server" };
      }
      console.error("[GenerateDocModal] Failed to set primary repo:", data);
      // Non-fatal — log and continue so generation still proceeds
    } else {
      // Refresh the in-memory org so organization.primary_repo is populated
      await refreshProfile();
    }
  };

  /**
   * Calls /api/generate-doc and handles success / error states.
   */
  const runGenerateDoc = async (
    validUrls: string[],
    installationId: string | null | undefined,
    organizationId: string | null | undefined,
    reviewMode: boolean,
  ): Promise<void> => {
    try {
      setIsGenerating(true);
      const isRegeneration = isRegenerating && !!activeDoc?.id;
      if (isRegeneration) {
        setGeneratingId(activeDoc.id, parentId);
      } else if (!reviewMode) {
        const sidebarData = useDocStore.getState().sidebarData;
        const changesetFolder = sidebarData.find(
          (item) => item.type === "folder" && item.name === "Changeset Summary"
        );
        const genParentId = changesetFolder ? changesetFolder.id : "changeset-summary-folder";
        setGeneratingId("generating", genParentId);
        setTimeout(() => {
          router.push("/dashboard?doc=generating");
        }, 0);
      }

      const response = await fetch("/api/generate-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diffUrls: validUrls,
          installationId,
          organizationId,
          reviewMode,
        }),
      });

      let data;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("[runGenerateDoc] Failed to parse response:", responseText);
        throw new Error("Generation failed: Server returned an invalid response.");
      }

      if (!response.ok) {
        if (isPlanLimitError(data)) {
          onPlanLimitReached?.(data?.error);
          const currentDocId = new URLSearchParams(window.location.search).get(
            "doc",
          );
          if (currentDocId === "generating") {
            router.push("/dashboard");
          }
          return;
        }
        throw new Error(data?.error || "Failed to generate document");
      }

      if (data?.reviewId) {
        useDocStore.getState().setPendingReviewRequest(data as ReviewRequestPayload);
        onClose();
        setDiffUrls([""]);
        lastSyncedUrls.current = null;
        return;
      }

      await onSuccess(data, validUrls);
      setDiffUrls([""]);
      lastSyncedUrls.current = null;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "An error occurred while fetching the code diff.",
      );
      console.error("Error fetching PR diff:", error);

      const currentDocId = new URLSearchParams(window.location.search).get(
        "doc",
      );
      if (currentDocId === "generating") {
        router.push("/dashboard");
      }
      onOpen(); // Re-open the modal on failure
    } finally {
      setIsGenerating(false);
      setGeneratingId(null);
    }
  };

  const handleGenerateDoc = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validUrls = diffUrls.filter((url) => url.trim() !== "");
    if (validUrls.length === 0) return;

    const installationId = organization?.github_installation_id;
    const organizationId = organization?.id;

    const prUrlPattern =
      /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
    const commitUrlPattern =
      /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/commit\/([a-f0-9]+)/;
    const isBaseRepoUrl =
      validUrls.length === 1 &&
      !prUrlPattern.test(validUrls[0]) &&
      !commitUrlPattern.test(validUrls[0]);

    const isAdmin =
      organization?.user_role === "admin" ||
      organization?.created_by === user?.id;

    // ── BOOTSTRAP FLOW (bare repo URL) ───────────────────────────────────────
    if (isBaseRepoUrl) {
      const inferredSlug = extractRepoSlug(validUrls[0]);

      // If a primary repo is already set, validate the URL belongs to it
      if (organization?.primary_repo) {
        if (
          inferredSlug &&
          inferredSlug !== organization.primary_repo.toLowerCase()
        ) {
          toast.error(
            `The URL does not belong to the workspace repository (${organization.primary_repo}).`,
          );
          return;
        }
      } else if (!isAdmin) {
        toast.error(
          "Only administrators can configure the primary repository for this workspace.",
        );
        return;
      }

      try {
        const { successCount, totalModules } = await runBootstrap(
          validUrls[0],
          installationId,
          organizationId,
        );

        if (totalModules > 0 && successCount === 0) {
          throw new Error("Failed to generate any documentation modules. Please check your Gemini API key, GitHub connection, or rate limits.");
        }

        // If no primary repo was set yet, set the bootstrapped repo as primary
        if (!organization?.primary_repo && inferredSlug && organizationId) {
          await setPrimaryRepo(organizationId, inferredSlug);
        }

        if (successCount > 0) {
          toast.success(`Successfully bootstrapped ${successCount} modules!`);
        }

        // Trigger sidebar refresh
        await onSuccess({ isBootstrap: true, metadata: {} }, validUrls);
        setDiffUrls([""]);
        lastSyncedUrls.current = null;
        onClose();
      } catch (error: any) {
        toast.error(
          error.message || "An error occurred during repository bootstrap.",
        );
        console.error("Bootstrap error:", error);
      } finally {
        setBootstrapProgress(null);
      }
      return;
    }

    // ── PR / COMMIT FLOW ─────────────────────────────────────────────────────

    const reviewMode = !isBaseRepoUrl;

    if (organization?.primary_repo) {
      // Primary repo IS set — validate all URLs belong to it
      const primaryRepo = organization.primary_repo.toLowerCase();
      const invalidUrl = validUrls.find((url) => {
        const slug = extractRepoSlug(url);
        return !slug || slug !== primaryRepo;
      });

      if (invalidUrl) {
        toast.error(
          `One or more URLs do not belong to the workspace repository (${organization.primary_repo}).`,
        );
        return;
      }

      // URLs are valid — proceed to generate
      await runGenerateDoc(validUrls, installationId, organizationId, reviewMode);
    } else {
      if (!isAdmin) {
        toast.error(
          "Primary repository not configured. Please contact an administrator.",
        );
        return;
      }
      // Primary repo NOT set — auto-bootstrap the inferred repo first, then generate
      const inferredSlug = extractRepoSlug(validUrls[0]);
      if (!inferredSlug) {
        toast.error(
          "Could not determine the repository from the provided URL.",
        );
        return;
      }

      const repoUrl = `https://github.com/${inferredSlug}`;

      try {
        // Step 1: Bootstrap the inferred repo
        const { successCount, totalModules } = await runBootstrap(
          repoUrl,
          installationId,
          organizationId,
        );

        if (totalModules > 0 && successCount === 0) {
          throw new Error("Failed to generate any documentation modules. Please check your Gemini API key, GitHub connection, or rate limits.");
        }

        if (successCount > 0) {
          toast.success(
            `Bootstrapped ${successCount} module(s) for ${inferredSlug}.`,
          );
        }

        // Step 2: Set as primary repo and refresh org context
        if (organizationId) {
          await setPrimaryRepo(organizationId, inferredSlug);
        }

        setBootstrapProgress(null);

        // Explicitly trigger a sidebar refresh to show Code Reference before generate doc starts
        await onSuccess({ isBootstrap: true, metadata: {} }, validUrls);

        // Step 3: Generate the changeset summary for the original diff URLs
        await runGenerateDoc(validUrls, installationId, organizationId, reviewMode);
      } catch (error: any) {
        toast.error(
          error.message ||
          "An error occurred while setting up the repository. Please try again.",
        );
        console.error("Auto-bootstrap error:", error);
        setBootstrapProgress(null);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      showCloseButton={!bootstrapProgress && !isGenerating}
      title={
        bootstrapProgress
          ? "Bootstrapping Repository"
          : isGenerating
            ? "Generating Documentation"
            : "Generate Documentation with AI"
      }
    >
      {bootstrapProgress ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div
            className="text-primary animate-spin"
            style={{ animationDuration: "4000ms" }}
          >
            <Loader />
          </div>
          <div className="text-center">
            <p className="text-textPrimary font-medium">
              Processing Modules...
            </p>
            <p className="text-textSecondary text-sm mt-1">
              {bootstrapProgress.module}
            </p>
          </div>
          <div className="w-full bg-secondaryBg rounded-full h-2.5 mt-4 overflow-hidden">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${(bootstrapProgress.current / bootstrapProgress.total) * 100}%`,
              }}
            ></div>
          </div>
          <p className="text-xs text-textMuted mt-2">
            {bootstrapProgress.current > 0
              ? `${bootstrapProgress.current} of ${bootstrapProgress.total} modules completed`
              : "Initializing..."}
          </p>
          <p className="text-xs text-textMuted mt-2">
            Please do not close this window.
          </p>
        </div>
      ) : isGenerating ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-primary animate-spin"
            style={{ animationDuration: "4000ms" }}>
            <Loader />
          </div>
          <div className="text-center space-y-2">
            <p className="text-textPrimary font-semibold text-lg">
              Generating Documentation...
            </p>
            <p className="text-textSecondary text-sm max-w-xs mx-auto">
              Analyzing PR changes and building section updates. This might take a few moments.
            </p>
            <p className="text-xs text-textMuted mt-4">
              Please do not close this window.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGenerateDoc} className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-regular text-textSecondary block">
                Enter Pull Request, Commit, or Base Repository URLs:
              </label>
              <button
                type="button"
                onClick={() => setDiffUrls([...diffUrls, ""])}
                className="text-xs text-primary hover:text-opacity-80 flex items-center gap-1"
              >
                <AddIcon sx={{ fontSize: 16 }} />
                Add URL
              </button>
            </div>

            {diffUrls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="url"
                  required
                  autoFocus={index === diffUrls.length - 1}
                  value={url}
                  onChange={(e) => {
                    const newUrls = [...diffUrls];
                    newUrls[index] = e.target.value;
                    setDiffUrls(newUrls);
                  }}
                  placeholder="https://github.com/org/repo/pull/123..."
                  className="flex-1 px-4 py-2 border border-border rounded-md bg-transparent text-textPrimary focus:outline-none"
                />
                {diffUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newUrls = diffUrls.filter((_, i) => i !== index);
                      setDiffUrls(newUrls);
                    }}
                    className="p-2 text-textSecondary hover:text-red-500 transition-colors"
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 20 }} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-primary text-textPrimary rounded-md hover:bg-opacity-80 transition-colors disabled:opacity-50"
          >
            <>
              <AutoAwesome sx={{ fontSize: 18 }} />
              Generate
            </>
          </button>
        </form>
      )}
    </Modal>
  );
};

export default GenerateDocModal;
