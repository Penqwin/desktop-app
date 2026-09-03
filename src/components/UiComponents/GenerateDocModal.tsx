import { useState, useEffect } from "react";
import Modal from "./Modal";
import { toast } from "sonner";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Loader from "./Loader";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import {
  localDb_createItem,
  localDb_getSidebarItems,
} from "@/services/localDb";

const electronAPI = (window as any).electronAPI;

interface GenerateDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any, validUrls: string[]) => void;
  onOpen: () => void;
  parentId?: number | string | null;
  // Included to satisfy typescript / old usages if they exist, though not used here
  onPlanLimitReached?: (message?: string) => void;
  isRegenerating?: boolean;
  initialUrls?: string[];
  autoStart?: boolean;
}

export default function GenerateDocModal({
  isOpen,
  onClose,
  onSuccess,
  parentId = null,
  autoStart = false,
  initialUrls = [],
}: GenerateDocModalProps) {
  const [repoPath, setRepoPath] = useState<string>(
    localStorage.getItem("last_repo_path") || "",
  );
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedCommits, setSelectedCommits] = useState<Set<string>>(
    new Set(),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);

  useEffect(() => {
    if (isOpen && repoPath) {
      const timer = setTimeout(() => {
        fetchCommits(repoPath);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, repoPath]);

  const handleClose = () => {
    if (isGenerating) return;
    onClose();
  };

  const handleSelectDirectory = async () => {
    const api = (window as any).electronAPI;
    if (!api) {
      toast.error("Electron API not available on window object.");
      return;
    }

    try {
      const res = await api.selectDirectory();
      if (res.success && res.data) {
        setRepoPath(res.data);
        localStorage.setItem("last_repo_path", res.data);
        fetchCommits(res.data);
      } else if (res.error !== "Canceled") {
        toast.error(res.error || "Failed to select directory");
      }
    } catch (e: any) {
      toast.error("Failed to communicate with Electron. Error: " + e.message);
    }
  };

  const fetchCommits = async (path: string) => {
    const api = (window as any).electronAPI;
    if (!api) return;
    setIsLoadingCommits(true);
    try {
      const res = await api.gitLog(path);
      if (res.success && res.data) {
        setCommits(res.data);
      } else {
        toast.error(res.error || "Failed to fetch commits");
        setCommits([]);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch commits");
      setCommits([]);
    } finally {
      setIsLoadingCommits(false);
    }
  };

  const toggleCommit = (hash: string) => {
    const next = new Set(selectedCommits);
    if (next.has(hash)) {
      next.delete(hash);
    } else {
      next.add(hash);
    }
    setSelectedCommits(next);
  };

  const handleGenerateDoc = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedCommits.size === 0) return;

    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      toast.error("Please configure your Gemini API key in Settings.");
      return;
    }

    const api = (window as any).electronAPI;
    if (!api) {
      toast.error("Electron API not available on window object.");
      return;
    }

    setIsGenerating(true);
    try {
      const hashes = Array.from(selectedCommits);
      const diffRes = await api.gitDiffCommits(hashes, repoPath);
      if (!diffRes.success) {
        throw new Error(diffRes.error || "Failed to get commit diffs");
      }

      const diff = diffRes.data;
      if (!diff) {
        throw new Error("No changes found in selected commits");
      }

      const genRes = await api.generateDoc({
        apiKey,
        userMessage: diff,
      });

      if (!genRes.success) {
        throw new Error(genRes.error || "Failed to generate documentation");
      }

      const generatedMarkdown = genRes.data;

      // Ensure target folder exists
      const isBootstrap = autoStart || (initialUrls && initialUrls.length > 0);
      const targetFolderName = isBootstrap
        ? "Code Reference"
        : "Changeset Summary";

      const sidebarItems = await localDb_getSidebarItems();
      let targetFolder = sidebarItems.find(
        (item) =>
          item.type === "folder" &&
          item.name === targetFolderName &&
          item.parent_id === null,
      );

      if (!targetFolder) {
        targetFolder = await localDb_createItem(targetFolderName, true, null);
      }

      // Save to local IndexedDB inside target folder
      let docName = `Doc: ${hashes.length} commits`;
      if (hashes.length === 1) {
        const commit = commits.find((c) => c.hash === hashes[0]);
        docName =
          commit && commit.message
            ? commit.message
            : `Doc: ${hashes[0].substring(0, 7)}`;
      }

      const newItem = await localDb_createItem(
        docName,
        false,
        targetFolder.id,
        generatedMarkdown,
      );

      // Tell the sidebar/app that a new doc was created
      onSuccess({ summaryDocId: newItem.id }, []);
      setSelectedCommits(new Set());
      onClose();
      toast.success("Documentation generated successfully!");
    } catch (error: any) {
      console.error(error);
      let errorMessage = error.message || "An error occurred during generation";
      if (
        errorMessage.includes("429 Too Many Requests") ||
        errorMessage.includes("Quota exceeded")
      ) {
        errorMessage =
          "Gemini API rate limit exceeded. Please wait a minute and try again. (Free tier token limit)";
      }
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      showCloseButton={!isGenerating}
      title={
        isGenerating
          ? "Generating Documentation"
          : "Generate Docs from Local Git"
      }
    >
      {isGenerating ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div
            className="text-primary animate-spin"
            style={{ animationDuration: "4000ms" }}
          >
            <Loader />
          </div>
          <div className="text-center space-y-2">
            <p className="text-textPrimary font-semibold text-lg">
              Generating Documentation...
            </p>
            <p className="text-textSecondary text-sm max-w-xs mx-auto">
              Analyzing your local git commits and generating a summary.
            </p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleGenerateDoc}
          className="space-y-4 flex flex-col max-h-[70vh]"
        >
          <div className="space-y-2 shrink-0">
            <label className="text-sm font-medium text-textSecondary block">
              Repository Path
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="Paste local git repository path or click Browse..."
                className="flex-1 px-3 py-2 border border-border rounded-md bg-secondaryBg text-textPrimary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSelectDirectory}
                className="px-3 py-2 bg-secondaryBg hover:bg-border transition-colors rounded-md text-textPrimary flex items-center gap-2"
              >
                <FolderOpenIcon fontSize="small" />
                Browse
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border border-border rounded-md mt-4 min-h-[300px]">
            {isLoadingCommits ? (
              <div className="flex justify-center items-center h-full py-10 text-textSecondary">
                Loading commits...
              </div>
            ) : commits.length === 0 ? (
              <div className="flex justify-center items-center h-full py-10 text-textSecondary">
                {repoPath
                  ? "No commits found in this repository."
                  : "Please select a repository."}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {commits.map((commit: any) => (
                  <li
                    key={commit.hash}
                    className="flex items-start gap-3 p-3 hover:bg-secondaryBg/50 cursor-pointer transition-colors"
                    onClick={() => toggleCommit(commit.hash)}
                  >
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedCommits.has(commit.hash)}
                        onChange={() => toggleCommit(commit.hash)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-border bg-secondaryBg"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-textMuted bg-secondaryBg px-1.5 py-0.5 rounded">
                          {commit.hash.substring(0, 7)}
                        </span>
                        <span
                          className="text-sm font-medium text-textPrimary truncate"
                          title={commit.message}
                        >
                          {commit.message}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-textSecondary">
                        <span>{commit.author_name}</span>
                        <span>&bull;</span>
                        <span>{new Date(commit.date).toLocaleString()}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={selectedCommits.size === 0}
            className="w-full shrink-0 mt-4 flex items-center justify-center gap-2 py-2 bg-primary text-textPrimary rounded-md hover:bg-opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <AutoAwesome sx={{ fontSize: 18 }} />
            Generate Docs{" "}
            {selectedCommits.size > 0 && `(${selectedCommits.size} selected)`}
          </button>
        </form>
      )}
    </Modal>
  );
}
