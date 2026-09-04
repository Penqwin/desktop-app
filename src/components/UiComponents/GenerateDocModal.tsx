import { useState, useEffect } from "react";
import Modal from "./Modal";
import { toast } from "sonner";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Loader from "./Loader";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import {
  localDb_createItem,
  localDb_getSidebarItems,
  localDb_saveContent,
} from "@/services/localDb";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const electronAPI = (window as any).electronAPI;

// ─── Code Reference Sync ──────────────────────────────────────────────────────

/**
 * After a changeset summary is generated, keep the Code Reference folder in
 * sync with the actual codebase changes:
 *   - Modified files  → regenerate and overwrite the existing doc in-place
 *   - Added files     → generate and create a new doc (+ any missing folders)
 *   - Deleted files   → skip (preserve the historical reference doc)
 *
 * Guard: if no "Code Reference" root folder exists the function is a no-op.
 */
async function syncCodeReference(
  api: any,
  apiKey: string,
  diff: string,
  repoPath: string,
): Promise<void> {
  // 1. Parse which files were touched in the diff
  const parseRes = await api.getChangedFilesFromDiff(diff);
  if (!parseRes.success) {
    console.warn("Could not parse changed files from diff:", parseRes.error);
    return;
  }
  const { added, modified, deleted: _deleted } = parseRes.data as {
    added: string[];
    modified: string[];
    deleted: string[];
  };

  // Files whose names should never be documented (same skip list as bootstrap)
  const SKIP_FILE_NAMES = new Set([
    "readme.md", "readme.txt", "readme",
    "changelog.md", "changelog.txt", "changelog",
    "license", "license.md", "license.txt",
    "contributing.md", "contributing.txt",
    "code_of_conduct.md",
    "authors", "authors.md",
    "notice", "notice.md",
    "makefile",
    ".gitignore", ".gitattributes", ".editorconfig",
    ".eslintignore", ".prettierignore",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "bun.lockb",
  ]);

  const filesToSync = [...modified, ...added].filter((fp) => {
    const name = fp.split(/[\\/]/).pop() || "";
    return !SKIP_FILE_NAMES.has(name.toLowerCase());
  });

  if (filesToSync.length === 0) return;

  // 2. Guard: Code Reference root must exist (i.e. bootstrap was run)
  const allItems = await localDb_getSidebarItems();
  const codeRefRoot = allItems.find(
    (item) => item.type === "folder" && item.name === "Code Reference" && item.parent_id === null,
  );
  if (!codeRefRoot) return; // Not bootstrapped — nothing to sync

  const { toast } = await import("sonner");
  const toastId = toast.loading(`Syncing Code Reference (${filesToSync.length} file${filesToSync.length > 1 ? "s" : ""})…`);

  let updatedCount = 0;
  let addedCount = 0;

  for (let i = 0; i < filesToSync.length; i++) {
    const filePath = filesToSync[i];
    const parts = filePath.split(/[\\/]/);
    const fileName = parts[parts.length - 1];

    try {
      // Read current file content from disk
      const absolutePath = repoPath + "/" + filePath;
      const fileRes = await api.readFile(absolutePath);
      if (!fileRes.success || !fileRes.data?.trim()) {
        console.warn("Skipping unreadable/empty file:", filePath);
        continue;
      }

      // Regenerate doc via Gemini (bootstrap prompt = file-level reference)
      const genRes = await api.generateDoc({
        apiKey,
        userMessage: `File: ${filePath}\n\n` + fileRes.data,
        isBootstrap: true,
      });
      if (!genRes.success) throw new Error(genRes.error);
      const newMarkdown = genRes.data;

      // 3. Find the existing Code Reference doc by traversing the folder path
      const freshItems = await localDb_getSidebarItems();

      let currentParentId: string | number = codeRefRoot.id;
      let existingDoc: typeof freshItems[0] | undefined;

      // Walk folder segments to find the doc's parent folder
      for (let s = 0; s < parts.length - 1; s++) {
        const segment = parts[s];
        const folder = freshItems.find(
          (item) =>
            item.type === "folder" &&
            item.name === segment &&
            String(item.parent_id) === String(currentParentId),
        );
        if (!folder) {
          // Folder doesn't exist → this is a new path, build it from here
          currentParentId = await ensureFolderPath(parts.slice(0, s + 1), codeRefRoot.id);
          break;
        }
        currentParentId = folder.id;
      }

      // Look for an existing doc with this filename inside the resolved parent
      const finalItems = await localDb_getSidebarItems();
      existingDoc = finalItems.find(
        (item) =>
          item.type === "file" &&
          item.name === fileName &&
          String(item.parent_id) === String(currentParentId),
      );

      if (existingDoc) {
        // Update in-place
        await localDb_saveContent(existingDoc.id, newMarkdown);
        updatedCount++;
      } else {
        // Create new doc under the resolved parent
        await localDb_createItem(fileName, false, currentParentId, newMarkdown);
        addedCount++;
      }
    } catch (err: any) {
      console.warn(`Code Reference sync: failed for ${filePath}:`, err.message);
    }

    // Pace requests to respect Gemini free-tier rate limits
    if (i < filesToSync.length - 1) await sleep(4000);
  }

  const summaryParts: string[] = [];
  if (updatedCount > 0) summaryParts.push(`${updatedCount} updated`);
  if (addedCount > 0) summaryParts.push(`${addedCount} added`);
  toast.success(`Code Reference synced — ${summaryParts.join(", ")}`, { id: toastId });
}

/**
 * Ensures all folder segments in `pathParts` exist under `rootId`,
 * creating any missing ones. Returns the id of the deepest folder.
 */
async function ensureFolderPath(
  pathParts: string[],
  rootId: string | number,
): Promise<string | number> {
  let currentParentId: string | number = rootId;

  for (const part of pathParts) {
    const items = await localDb_getSidebarItems();
    let folder = items.find(
      (item) =>
        item.type === "folder" &&
        item.name === part &&
        String(item.parent_id) === String(currentParentId),
    );
    if (!folder) {
      folder = await localDb_createItem(part, true, currentParentId);
    }
    currentParentId = folder.id;
  }

  return currentParentId;
}

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
  const [bootstrapProgress, setBootstrapProgress] = useState<{current: number, total: number, file: string} | null>(null);
  const [isBootstrapMode, setIsBootstrapMode] = useState<boolean>(
    autoStart || (initialUrls && initialUrls.length > 0)
  );

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

  
  const handleBootstrap = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!repoPath) return;

    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      toast.error("Please configure your Gemini API key in Settings.");
      return;
    }

    const api = (window as any).electronAPI;
    if (!api || !api.readDirRecursive || !api.readFile) {
      toast.error("File system Electron API not available. Ensure backend is updated.");
      return;
    }

    setIsGenerating(true);
    setBootstrapProgress({ current: 0, total: 0, file: "Scanning directory..." });

    // Files whose names (case-insensitive) should never be documented.
    // These are typically project meta-files, not source code.
    const SKIP_FILE_NAMES = new Set([
      "readme.md", "readme.txt", "readme",
      "changelog.md", "changelog.txt", "changelog",
      "license", "license.md", "license.txt",
      "contributing.md", "contributing.txt",
      "code_of_conduct.md",
      "authors", "authors.md",
      "notice", "notice.md",
      "makefile",
      ".gitignore", ".gitattributes", ".editorconfig",
      ".eslintignore", ".prettierignore",
      "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
      "bun.lockb",
    ]);

    try {
      // 1. Scan directory
      const dirRes = await api.readDirRecursive(repoPath);
      if (!dirRes.success) throw new Error(dirRes.error || "Failed to scan directory");
      const allFiles: string[] = dirRes.data;

      // Filter out irrelevant files before processing
      const files = allFiles.filter((filePath) => {
        const fileName = filePath.split(/[\\/]/).pop() || "";
        return !SKIP_FILE_NAMES.has(fileName.toLowerCase());
      });

      if (files.length === 0) throw new Error("No valid files found in directory");

      // 2. Create Code Reference root folder
      const sidebarItems = await localDb_getSidebarItems();
      let targetFolder = sidebarItems.find(
        (item) => item.type === "folder" && item.name === "Code Reference" && item.parent_id === null
      );
      if (!targetFolder) {
        targetFolder = await localDb_createItem("Code Reference", true, null);
      }

      setBootstrapProgress({ current: 0, total: files.length, file: "Starting generation..." });

      // 3. Process each file
      let processed = 0;
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        processed++;
        setBootstrapProgress({ current: processed, total: files.length, file: filePath });

        // Read file content
        const absolutePath = repoPath + "/" + filePath;
        const fileRes = await api.readFile(absolutePath);
        if (!fileRes.success) {
          console.warn("Failed to read file:", filePath, fileRes.error);
          continue; // Skip file if unreadable
        }
        const content = fileRes.data;
        if (!content.trim()) continue; // Skip empty files

        // Call Gemini (isBootstrap = true)
        let generatedMarkdown = "";
        try {
          const genRes = await api.generateDoc({
            apiKey,
            userMessage: `File: ${filePath}\n\n` + content,
            isBootstrap: true
          });
          if (!genRes.success) throw new Error(genRes.error);
          generatedMarkdown = genRes.data;
        } catch (err: any) {
          // If rate limited, sleep and retry once
          if (err.message && (err.message.includes("429") || err.message.includes("Quota"))) {
            toast.warning(`Rate limited on ${filePath}. Waiting 15s to retry...`);
            await sleep(15000);
            const genRes = await api.generateDoc({
              apiKey,
              userMessage: `File: ${filePath}\n\n` + content,
              isBootstrap: true
            });
            if (!genRes.success) throw new Error(genRes.error);
            generatedMarkdown = genRes.data;
          } else {
            throw err;
          }
        }

        // Create folder hierarchy
        const parts = filePath.split(/[\\/]/);
        const fileName = parts.pop() as string;
        let currentParentId = targetFolder.id;

        for (const part of parts) {
          // Look for existing folder in db (note: we re-fetch to ensure we have latest)
          const allItems = await localDb_getSidebarItems();
          let existing = allItems.find(
            (item) =>
              item.type === "folder" &&
              item.name === part &&
              // Normalize both sides to string — parent_id is stored as a string in
              // IndexedDB but currentParentId may be a number from generateId(),
              // so strict equality would silently fail and create duplicate folders.
              String(item.parent_id) === String(currentParentId)
          );
          if (!existing) {
            existing = await localDb_createItem(part, true, currentParentId);
          }
          currentParentId = existing.id;
        }

        // Save doc
        await localDb_createItem(fileName, false, currentParentId, generatedMarkdown);

        // Sleep to avoid rate limiting (4 seconds for free tier 15 RPM)
        if (i < files.length - 1) {
          await sleep(4000); 
        }
      }

      onSuccess({ isBootstrap: true }, []);
      onClose();
      toast.success("Repository bootstrapped successfully!");
    } catch (error: any) {
      console.error(error);
      let errorMessage = error.message || "An error occurred during generation";
      if (errorMessage.includes("429") || errorMessage.includes("Quota")) {
        errorMessage = "Gemini API rate limit exceeded. Please wait a minute and try again.";
      }
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
      setBootstrapProgress(null);
    }
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

      // ── Code Reference sync (non-blocking, runs after modal closes) ──────
      // Fire-and-forget: parse which files changed and sync Code Reference.
      syncCodeReference(api, apiKey, diff, repoPath).catch((err) =>
        console.warn("Code Reference sync failed:", err)
      );
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
          : "Repository Assistant"
      }
    >
      {!isGenerating && (
        <div className="flex border-b border-border mb-4">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium ${!isBootstrapMode ? 'text-primary border-b-2 border-primary' : 'text-textSecondary hover:text-textPrimary'}`}
            onClick={() => setIsBootstrapMode(false)}
          >
            Git Diff Summary
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium ${isBootstrapMode ? 'text-primary border-b-2 border-primary' : 'text-textSecondary hover:text-textPrimary'}`}
            onClick={() => setIsBootstrapMode(true)}
          >
            Bootstrap Entire Repo
          </button>
        </div>
      )}
      {isGenerating ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-primary animate-spin" style={{ animationDuration: "4000ms" }}>
            <Loader />
          </div>
          <div className="text-center space-y-2">
            <p className="text-textPrimary font-semibold text-lg">
              {bootstrapProgress ? `Processing ${bootstrapProgress.current} of ${bootstrapProgress.total}` : "Generating Documentation..."}
            </p>
            <p className="text-textSecondary text-sm max-w-xs mx-auto truncate" title={bootstrapProgress?.file}>
              {bootstrapProgress ? bootstrapProgress.file : "Analyzing your local git commits and generating a summary."}
            </p>
          </div>
        </div>
      ) : isBootstrapMode ? (
        <form onSubmit={handleBootstrap} className="space-y-4 flex flex-col max-h-[70vh]">
          <div className="space-y-2 shrink-0">
            <label className="text-sm font-medium text-textSecondary block">
              Repository Path
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="Select the local repository to bootstrap..."
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
          
          <div className="flex-1 border border-border rounded-md mt-4 p-4 text-textSecondary bg-secondaryBg text-sm text-center flex flex-col items-center justify-center space-y-2 min-h-[150px]">
             <p>This process will scan all code files in the directory.</p>
             <p>A folder structure mimicking the repository will be created under "Code Reference".</p>
             <p className="text-yellow-500">Note: API requests are automatically paced to respect Free Tier rate limits (15/min).</p>
          </div>

          <button
            type="submit"
            disabled={!repoPath}
            className="w-full shrink-0 mt-4 flex items-center justify-center gap-2 py-2 bg-primary text-textPrimary rounded-md hover:bg-opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <AutoAwesome sx={{ fontSize: 18 }} />
            Start Bootstrap
          </button>
        </form>
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
