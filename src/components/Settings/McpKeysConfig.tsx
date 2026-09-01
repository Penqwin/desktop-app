// src/app/components/Settings/McpKeysConfig.tsx

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ConfirmationModal } from "../UiComponents/ConfirmationModal";
import Modal from "../UiComponents/Modal";
import Loader from "../UiComponents/Loader";
import CircularLoader from "@/app/assets/svg/circular_loader";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";

interface McpKey {
  id: string;
  label: string;
  last_used: string | null;
  created_at: string;
}

export default function McpKeysConfig({ orgId }: { orgId: string }) {
  const [keys, setKeys] = useState<McpKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals / Actions states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [isRotateConfirmOpen, setIsRotateConfirmOpen] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Key display modal (shown after Create or Rotate)
  const [generatedKey, setGeneratedKey] = useState<{
    rawKey: string;
    label: string;
    action: "created" | "rotated";
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch keys on mount or org change
  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`/api/organization/mcp-keys?orgId=${orgId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch MCP API keys");
      }
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "An unexpected error occurred";
      console.error(err);
      toast.error(errMsg || "Could not load MCP API keys");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Create new API key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/organization/mcp-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, label: newKeyLabel.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create MCP API key");
      }

      toast.success("MCP API key generated!");
      setKeys((prev) => [data.key, ...prev]);
      setGeneratedKey({
        rawKey: data.rawKey,
        label: data.key.label,
        action: "created",
      });
      setIsCreateModalOpen(false);
      setNewKeyLabel("");
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to generate key";
      toast.error(errMsg);
    } finally {
      setIsCreating(false);
    }
  };

  // Rotate existing API key (updates key_hash)
  const handleRotateKey = async () => {
    if (!rotatingKeyId) return;

    setIsRotating(true);
    const keyToRotate = keys.find((k) => k.id === rotatingKeyId);
    try {
      const res = await fetch("/api/organization/mcp-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          keyId: rotatingKeyId,
          label: keyToRotate?.label,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to rotate MCP API key");
      }

      toast.success("MCP API key rotated successfully!");
      setKeys((prev) =>
        prev.map((k) => (k.id === rotatingKeyId ? data.key : k)),
      );
      setGeneratedKey({
        rawKey: data.rawKey,
        label: data.key.label,
        action: "rotated",
      });
      setIsRotateConfirmOpen(false);
      setRotatingKeyId(null);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to rotate key";
      toast.error(errMsg);
    } finally {
      setIsRotating(false);
    }
  };

  // Revoke / Delete API key
  const handleDeleteKey = async () => {
    if (!deletingKeyId) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/organization/mcp-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, keyId: deletingKeyId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke MCP API key");
      }

      toast.success("MCP API key revoked!");
      setKeys((prev) => prev.filter((k) => k.id !== deletingKeyId));
      setIsDeleteConfirmOpen(false);
      setDeletingKeyId(null);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to revoke key";
      toast.error(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <VpnKeyIcon sx={{ fontSize: 20 }} className="text-textPrimary" />
            <h3 className="font-bold text-textPrimary">MCP API Keys</h3>
          </div>
          <p className="text-xs text-textMuted leading-relaxed max-w-md">
            Generate and manage secure machine-to-machine API keys to connect
            external Model Context Protocol (MCP) clients to this workspace.
            <br />
            See the{" "}
            <a
              href="https://www.penqwin.com/mcp#setup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              MCP configuration guide
            </a>{" "}
            for setup instructions.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs font-mono bg-secondaryBg/40 border border-border px-3 py-1.5 rounded-lg w-fit text-textSecondary">
            <span className="text-textMuted select-none">Org ID:</span>
            <span>{orgId}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(orgId)}
              className="p-1 hover:bg-primary/10 hover:text-primary rounded text-textMuted transition-all flex items-center justify-center shrink-0"
              title="Copy Organization ID"
            >
              <ContentCopyIcon sx={{ fontSize: 12 }} />
            </button>
          </div>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-primary hover:opacity-90 text-textPrimary text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md self-start md:self-center whitespace-nowrap"
        >
          <AddIcon sx={{ fontSize: 16 }} />
          Create API Key
        </button>
      </div>

      {/* Keys List */}
      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="p-8 border border-border border-dashed rounded-xl text-center bg-secondaryBg/10">
            <p className="text-sm text-textMuted">
              No MCP API keys active. Create one to get started.
            </p>
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="p-4 border border-border bg-secondaryBg/30 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/20 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <VpnKeyIcon
                    sx={{ fontSize: 16 }}
                    className="text-primary/70"
                  />
                  <span className="font-bold text-textPrimary text-sm">
                    {key.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-textMuted">
                  <span>
                    Created: {new Date(key.created_at).toLocaleDateString()}
                  </span>
                  <span>•</span>
                  <span>
                    Last used:{" "}
                    {key.last_used
                      ? new Date(key.last_used).toLocaleString()
                      : "Never"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  onClick={() => {
                    setRotatingKeyId(key.id);
                    setIsRotateConfirmOpen(true);
                  }}
                  className="text-xs font-bold text-textSecondary hover:text-primary hover:bg-primary/5 transition-all px-3 py-1.5 rounded-lg bg-mainBg border border-border hover:border-primary/30 flex items-center gap-1"
                >
                  <RefreshIcon sx={{ fontSize: 14 }} />
                  Rotate
                </button>
                <button
                  onClick={() => {
                    setDeletingKeyId(key.id);
                    setIsDeleteConfirmOpen(true);
                  }}
                  className="text-xs font-bold text-error hover:bg-error/10 transition px-3 py-1.5 rounded-lg border border-transparent hover:border-error/20 flex items-center gap-1"
                >
                  <DeleteForeverIcon sx={{ fontSize: 16 }} />
                  Revoke
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 1. Modal: Create API Key Form */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create MCP API Key"
          modalClass="!w-[450px]"
        >
          <form onSubmit={handleCreateKey} className="flex flex-col gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-textSecondary uppercase tracking-widest opacity-80">
                Key Label / Description
              </label>
              <input
                type="text"
                required
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="e.g. Cursor MCP Server, Claude Desktop"
                className="w-full bg-secondaryBg border border-border rounded-xl px-4 py-3 text-sm text-textPrimary placeholder-textMuted outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-all duration-200"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-textSecondary hover:text-textPrimary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !newKeyLabel.trim()}
                className="bg-primary hover:opacity-90 text-textPrimary px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isCreating && <CircularLoader size={14} />}
                Generate Key
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. Modal: Display Generated Raw Key (Extremely Critical!) */}
      {generatedKey && (
        <Modal
          isOpen={!!generatedKey}
          onClose={() => setGeneratedKey(null)}
          title={
            generatedKey.action === "rotated"
              ? "MCP API Key Rotated"
              : "MCP API Key Generated"
          }
          modalClass="!w-[500px]"
          showCloseButton={false} // Force they read/copy before closing
        >
          <div className="flex flex-col gap-5">
            {/* Warning Alert Banner */}
            <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <WarningIcon sx={{ fontSize: 20 }} className="shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed font-medium">
                <span className="font-bold">Important:</span> Copy this API key
                now! For security reasons, it will{" "}
                <span className="font-bold">never</span> be shown again. If you
                lose this key, you must rotate or recreate it.
              </div>
            </div>

            {/* Display Field */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-textSecondary uppercase tracking-widest opacity-80">
                Generated Key ({generatedKey.label})
              </label>
              <div className="flex items-center gap-2 bg-secondaryBg border border-border rounded-xl p-3 select-all overflow-x-auto font-mono text-xs text-textPrimary">
                <span className="flex-1 whitespace-nowrap overflow-x-auto no-scrollbar py-1">
                  {generatedKey.rawKey}
                </span>
                <button
                  onClick={() => copyToClipboard(generatedKey.rawKey)}
                  className="p-2 bg-mainBg hover:bg-primary/10 hover:text-primary text-textSecondary border border-border rounded-lg transition-all shrink-0"
                  title="Copy Key"
                >
                  {copied ? (
                    <CheckIcon sx={{ fontSize: 16 }} className="text-primary" />
                  ) : (
                    <ContentCopyIcon sx={{ fontSize: 16 }} />
                  )}
                </button>
              </div>
            </div>

            {/* Acknowledge Button */}
            <div className="flex justify-end pt-3">
              <button
                onClick={() => setGeneratedKey(null)}
                className="bg-primary hover:opacity-90 text-textPrimary px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
              >
                I have copied the key
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 3. Modal: Rotate / Regenerate Key Confirmation */}
      {isRotateConfirmOpen && (
        <ConfirmationModal
          isOpen={isRotateConfirmOpen}
          onClose={() => {
            setIsRotateConfirmOpen(false);
            setRotatingKeyId(null);
          }}
          onConfirm={handleRotateKey}
          title="Rotate MCP API Key"
          message={
            <div className="space-y-3">
              <p>Are you sure you want to rotate this key?</p>
              <div className="flex gap-2 p-3 bg-red-600/10 border border-red-600/20 text-red-500 rounded-lg text-xs leading-relaxed">
                <WarningIcon sx={{ fontSize: 18 }} className="shrink-0" />
                <span>
                  Rotating will invalidate the existing key immediately. Any
                  integrations currently using it will fail until they are
                  updated with the new key.
                </span>
              </div>
            </div>
          }
          confirmLabel="Rotate & Invalidate"
          variant="danger"
          isLoading={isRotating}
        />
      )}

      {/* 4. Modal: Revoke Key Confirmation */}
      {isDeleteConfirmOpen && (
        <ConfirmationModal
          isOpen={isDeleteConfirmOpen}
          onClose={() => {
            setIsDeleteConfirmOpen(false);
            setDeletingKeyId(null);
          }}
          onConfirm={handleDeleteKey}
          title="Revoke MCP API Key"
          message="Are you sure you want to revoke this API key? This action is irreversible. External clients using this key will immediately lose access."
          confirmLabel="Revoke Key"
          variant="danger"
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
