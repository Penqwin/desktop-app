// src/components/GithubConnect.tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Loader from "@/app/components/UiComponents/Loader";
import { createPortal } from "react-dom";
/* Removed next/navigation */
import { ConfirmationModal } from "../UiComponents/ConfirmationModal";
import CircularLoader from "@/app/assets/svg/circular_loader";
import Dropdown from "../UiComponents/Dropdown";
import GitHubIcon from "@mui/icons-material/GitHub";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useDocStore } from "@/store/useDocStore";
import GenerateDocModal from "../UiComponents/GenerateDocModal";

export default function GithubConnect({
  userId,
  orgId,
  onBootstrapSuccess,
}: {
  userId: string;
  orgId: string;
  onBootstrapSuccess?: () => void;
}) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [githubMetadata, setGithubMetadata] = useState<{
    name: string;
    avatar_url: string;
    type: string;
  } | null>(null);
  const [isGhDisconnectConfirmModalOpen, setIsGhDisconnectConfirmModalOpen] =
    useState(false);

  const [repos, setRepos] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [isSavingRepo, setIsSavingRepo] = useState(false);
  const [isBootstrapModalOpen, setIsBootstrapModalOpen] = useState(false);

  const sidebarData = useDocStore((s) => s.sidebarData);
  const hasCodeReference = sidebarData.some(
    (item) => item.name === "Code Reference" && item.type === "folder",
  );

  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch(`/api/github/connection?orgId=${orgId}`);
        if (response.ok) {
          const data = await response.json();
          setIsConnected(data.isConnected);
          setOrgData(data.orgData);
          setGithubMetadata(data.githubMetadata);
          if (data.orgData?.primary_repo) {
            setSelectedRepo(data.orgData.primary_repo);
          }
        } else {
          setIsConnected(false);
        }
      } catch (error) {
        console.error("Failed to check GitHub status", error);
        setIsConnected(false);
      }
    }
    checkStatus();
  }, [orgId]);

  useEffect(() => {
    if (isConnected) {
      fetchRepos();
    }
  }, [isConnected, orgId]);

  const fetchRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const res = await fetch(`/api/github/repos?orgId=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos || []);
      }
    } catch (error) {
      console.error("Failed to fetch repos", error);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleRepoChange = async (repoFullName: string | number) => {
    const repo = repos.find(
      (r) => r.full_name.toLowerCase() === String(repoFullName).toLowerCase(),
    );
    if (!repo) return;

    const normalizedName = repo.full_name.toLowerCase();
    setSelectedRepo(normalizedName);
    setIsSavingRepo(true);
    try {
      const res = await fetch("/api/organization/set-primary-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          repoFullName: normalizedName,
          repoUrl: repo.html_url,
        }),
      });
      if (res.ok) {
        toast.success("Workspace repository updated!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update workspace repository");
      }
    } catch (error) {
      toast.error("An error occurred while saving");
    } finally {
      setIsSavingRepo(false);
    }
  };

  const queryString = searchParams.toString();
  const returnTo = `${pathname}${queryString ? `?${queryString}` : ""}`;
  const installUrl = `/api/github/link-init?orgId=${orgId}&returnTo=${encodeURIComponent(returnTo)}`;

  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncForm, setShowSyncForm] = useState(false);
  const [syncHandle, setSyncHandle] = useState("");

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncHandle.trim()) return;

    setIsSyncing(true);
    try {
      const response = await fetch("/api/github/link-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: syncHandle, orgId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sync failed");

      toast.success(data.message || "Successfully synced GitHub installation!");
      setIsConnected(true);
      const statusRes = await fetch(`/api/github/connection?orgId=${orgId}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setOrgData(statusData.orgData);
        setGithubMetadata(statusData.githubMetadata);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!orgData?.github_installation_id) return;

    try {
      const response = await fetch(`/api/github/connection?orgId=${orgId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to disconnect GitHub");

      // Update local state — no GitHub uninstall required
      setIsConnected(false);
      setOrgData(null);
      setGithubMetadata(null);
      setRepos([]);
      setSelectedRepo(null);
      toast.success("GitHub disconnected successfully.");
    } catch (err: any) {
      toast.error("Error: Could not disconnect GitHub account.");
    } finally {
      setIsGhDisconnectConfirmModalOpen(false);
    }
  };

  if (isConnected === null) return <Loader />;

  return (
    <>
      <div className="rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <GitHubIcon sx={{ fontSize: 20 }} className="text-textPrimary" />
          <h3 className="font-bold text-textPrimary">GitHub</h3>
        </div>

        {isConnected ? (
          <div className="space-y-6">
            <div className="p-4 border border-border bg-secondaryBg rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                {githubMetadata?.avatar_url && (
                  <img
                    src={githubMetadata.avatar_url}
                    className="w-10 h-10 rounded-full border border-border"
                    alt="Avatar"
                  />
                )}
                <div>
                  <p className="font-semibold text-textPrimary">
                    {githubMetadata?.name || "Connected Account"}
                  </p>
                  <p className="text-xs text-textMuted">
                    Connected as {githubMetadata?.type || "installation"}
                  </p>
                </div>
              </div>
              <button
                className="text-xs font-medium text-error hover:text-error/80 transition px-3 py-1.5 rounded-lg hover:bg-error/5"
                onClick={() => setIsGhDisconnectConfirmModalOpen(true)}
              >
                Disconnect
              </button>
            </div>

            <div className="space-y-3 pt-4 border-t border-border border-dashed">
              <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider">
                Workspace Repository
              </label>

              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Dropdown
                    value={selectedRepo || ""}
                    options={repos.map((r) => ({
                      value: r.full_name.toLowerCase(),
                      label: r.full_name,
                    }))}
                    onChange={handleRepoChange}
                    placeholder={
                      isLoadingRepos
                        ? "Loading repos..."
                        : "Select a repository"
                    }
                    searchable
                    disabled={isLoadingRepos || isSavingRepo}
                  />
                </div>
                {isSavingRepo && <CircularLoader size={16} />}

                {!hasCodeReference && selectedRepo && (
                  <button
                    onClick={() => setIsBootstrapModalOpen(true)}
                    disabled={isLoadingRepos || isSavingRepo}
                    className="flex text-sm bg-secondaryBg border border-border text-textSecondary px-4 py-2 rounded-lg hover:text-textPrimary transition flex items-center justify-center gap-2 font-semibold transition-all transform-gpu duration-200 ease-in-out whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <AutoAwesomeIcon sx={{ fontSize: 17 }} />
                    Bootstrap Repo
                  </button>
                )}
              </div>

              {repos.length === 0 && !isLoadingRepos && (
                <p className="text-[10px] text-error">
                  No repositories found. Make sure the GitHub App has access to
                  at least one repository.
                </p>
              )}

              <p className="text-xs text-textMuted leading-relaxed">
                Select the main repository for this workspace. This will be used
                as the default for AI generations.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-textSecondary mb-6 leading-relaxed">
              Connect your GitHub organization or account to start generating
              documentation from your private repositories.
            </p>

            <div className="flex flex-col gap-4 items-start">
              <a
                href={installUrl}
                className="bg-textPrimary hover:bg-textPrimary/90 text-mainBg px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2"
              >
                <GitHubIcon sx={{ fontSize: 18 }} />
                Install GitHub App
              </a>

              {!showSyncForm ? (
                <button
                  onClick={() => setShowSyncForm(true)}
                  className="text-xs text-textMuted hover:text-textSecondary transition underline underline-offset-4"
                >
                  Already installed? Sync existing account
                </button>
              ) : (
                <form
                  onSubmit={handleSync}
                  className="w-full max-w-sm mt-2 p-4 border border-border rounded-xl bg-mainBg/50"
                >
                  <p className="text-xs font-bold text-textPrimary mb-3 uppercase tracking-wider">
                    Sync Installation
                  </p>
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="Enter GitHub handle (e.g. acme-corp)"
                      className="w-full text-sm bg-mainBg border border-border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-all text-textPrimary"
                      value={syncHandle}
                      onChange={(e) => setSyncHandle(e.target.value)}
                      disabled={isSyncing}
                    />
                    <div className="flex gap-2 select-none transform-gpu transition-all ease-in-out duration-200">
                      <button
                        type="submit"
                        disabled={isSyncing || !syncHandle}
                        className="flex-1 text-sm bg-secondaryBg border border-border text-textSecondary py-2 rounded-lg hover:text-textPrimary disabled:opacity-50 transition flex items-center justify-center gap-2 font-semibold"
                      >
                        {isSyncing && <CircularLoader size={14} />}
                        {isSyncing ? "Syncing…" : "Sync Account"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSyncForm(false)}
                        className="px-4 py-2 text-sm text-textSecondary hover:text-textPrimary transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
      {createPortal(
        <ConfirmationModal
          isOpen={isGhDisconnectConfirmModalOpen}
          onClose={() => setIsGhDisconnectConfirmModalOpen(false)}
          onConfirm={handleDisconnect}
          variant="danger"
          confirmLabel="Disconnect"
          title="Disconnect GitHub"
          message={
            <>
              <div className="text-textPrimary leading-6">
                Are you sure you want to disconnect GitHub?
              </div>
              <div className="text-xs mt-2 leading-5">
                You will be redirected to GitHub App page.
              </div>
            </>
          }
        />,
        document.body,
      )}

      {isBootstrapModalOpen && (
        <GenerateDocModal
          isOpen={isBootstrapModalOpen}
          onClose={() => setIsBootstrapModalOpen(false)}
          onOpen={() => setIsBootstrapModalOpen(true)}
          initialUrls={[`https://github.com/${selectedRepo}`]}
          autoStart={true}
          onSuccess={async () => {
            setIsBootstrapModalOpen(false);
            // Refresh sidebar data so the new "Code Reference" folder appears immediately
            try {
              const res = await fetch(
                `/api/sidebar-data?orgId=${orgId}&t=${Date.now()}`,
              );
              if (res.ok) {
                const data = await res.json();
                useDocStore.getState().setSidebarData(data || []);
              }
            } catch (e) {
              console.error("Failed to refresh sidebar after bootstrap", e);
            }
            toast.success("Repository bootstrapping completed!");
            if (onBootstrapSuccess) onBootstrapSuccess();
          }}
        />
      )}
    </>
  );
}
