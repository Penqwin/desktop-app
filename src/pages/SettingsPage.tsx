import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import BusinessIcon from "@mui/icons-material/Business";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import GitHubIcon from "@mui/icons-material/GitHub";
import GeminiKeyConfig from "@/components/Settings/GeminiKeyConfig";
import { useUser } from "@/core/auth/UserContext";
import { toast } from "sonner";

const SettingsPage = () => {
  const navigate = useNavigate();
  const {
    organizations,
    activeOrganization,
    deleteOrganization,
    renameOrganization,
  } = useUser();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  const startEdit = (org: any) => {
    setEditingOrgId(org.id);
    setEditName(org.name);
  };

  const cancelEdit = () => {
    setEditingOrgId(null);
    setEditName("");
  };

  const handleRenameSubmit = async (orgId: string) => {
    if (!editName.trim() || isRenaming) return;
    setIsRenaming(true);
    try {
      await renameOrganization(orgId, editName.trim());
      setEditingOrgId(null);
      setEditName("");
      toast.success("Workspace renamed successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to rename workspace");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async (orgId: string) => {
    if (organizations.length <= 1) return;

    // Quick confirmation
    if (
      !window.confirm(
        "Are you sure you want to delete this workspace? This cannot be undone.",
      )
    )
      return;

    setIsDeleting(orgId);
    try {
      await deleteOrganization(orgId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(ROUTES.HOME)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
            title="Go back"
          >
            <ArrowBackIcon />
          </button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <div className="space-y-8">
          <GeminiKeyConfig />

          {/* Workspaces Section */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BusinessIcon /> Workspace
            </h2>
            <p className="text-sm text-gray-400 mb-6">Manage your workspace.</p>

            <div className="space-y-3">
              {activeOrganization && (
                <div
                  key={activeOrganization.id}
                  className="flex items-center justify-between p-4 bg-[#222] rounded-lg border border-[#333]"
                >
                  {editingOrgId === activeOrganization.id ? (
                    <div className="flex-1 flex items-center gap-2 mr-4">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            handleRenameSubmit(activeOrganization.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        disabled={isRenaming}
                        className="flex-1 bg-secondaryBg border border-primary focus:border-primary text-textPrimary text-sm rounded-md px-3 py-1.5 outline-none transition-colors"
                      />
                      <button
                        onClick={() =>
                          handleRenameSubmit(activeOrganization.id)
                        }
                        disabled={isRenaming || !editName.trim()}
                        className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50"
                        title="Save"
                      >
                        <CheckIcon fontSize="small" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={isRenaming}
                        className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                        title="Cancel"
                      >
                        <CloseIcon fontSize="small" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-200">
                          {activeOrganization.name}
                        </span>
                        <button
                          onClick={() => startEdit(activeOrganization)}
                          className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                          title="Rename workspace"
                        >
                          <EditIcon sx={{ fontSize: 14 }} />
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleDelete(activeOrganization.id)}
                    disabled={
                      organizations.length <= 1 ||
                      isDeleting === activeOrganization.id ||
                      editingOrgId === activeOrganization.id
                    }
                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      organizations.length <= 1
                        ? "Cannot delete the last workspace"
                        : "Delete workspace"
                    }
                  >
                    <DeleteIcon fontSize="small" />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-center pt-8">
            <a 
              href="https://github.com/Penqwin/desktop-app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-full transition-all duration-200"
              title="View Source on GitHub"
            >
              <GitHubIcon fontSize="small" />
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
