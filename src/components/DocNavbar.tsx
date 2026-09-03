import { useState, useEffect, useRef, useMemo } from "react";
import { useDocStore } from "@/store/useDocStore";
import { useSidebarOpen } from "@/layouts/DashboardLayout";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
// icons
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import AutoModeIcon from "@mui/icons-material/AutoMode";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import MenuIcon from "@mui/icons-material/Menu";
// enums
import { SaveStatus } from "@/core/enums/SaveStatus";
import GenerateDocModal from "./UiComponents/GenerateDocModal";
import { ConfirmationModal } from "./UiComponents/ConfirmationModal";
import { Editor } from "@tiptap/react";
import { isMac } from "@/core/utils/platform";
import { sanitizeTiptapContent } from "@/utils/sanitizeTiptapContent";
import { isPlanLimitError } from "@/utils/plan-limit";

const DocNavbar = ({ editor }: { editor: Editor | null }) => {
  const activeDoc = useDocStore((state) => state.activeDoc);
  const drafts = useDocStore((state) => state.drafts);
  const fetchingId = useDocStore((state) => state.fetchingId);
  const generatingId = useDocStore((state) => state.generatingId);
  const sidebarData = useDocStore((state) => state.sidebarData);
  const updateSidebarData = useDocStore((state) => state.updateSidebarData);
  const clearDraft = useDocStore((state) => state.clearDraft);
  const fetchDocContent = useDocStore((state) => state.fetchDocContent);
  const setActiveDoc = useDocStore((state) => state.setActiveDoc);
  const setGeneratingId = useDocStore((state) => state.setGeneratingId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SaveStatus.IDLE);
  const saveStatusRef = useRef<SaveStatus>(SaveStatus.IDLE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const openSidebar = useSidebarOpen();

  // Keep ref in sync so the keyboard listener never reads stale state
  useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

  const isInteractionDisabled =
    !!(
      activeDoc?.id &&
      (fetchingId === activeDoc.id || generatingId === activeDoc.id)
    ) ||
    (!activeDoc?.id && generatingId === "generating");
  const mac = isMac();
  const saveShortcut = mac ? "⌘S" : "Ctrl+S";

  const hasDraft = activeDoc?.id ? !!drafts[activeDoc.id] : false;

  const handleGenerateSuccess = async (data: any, validUrls: string[]) => {
    if (data.isBootstrap) {
      // DocNavbar doesn't need to do anything for bootstrap success
      return;
    }

    // ── UNIFIED PATH: always navigate to the new Changeset Summary ───────────
    if (data.summaryDocId) {
      await fetchDocContent(data.summaryDocId);
      navigate(`/?doc=${data.summaryDocId}`);
      return;
    }

    // ── LEGACY PATH: mapping update without a summary doc ──────────────────
    if (data.updated?.length > 0) return; // Sidebar handles navigation

    // ── LEGACY PATH: regenerate content in the current editor ─────────────
    const documentation = data.documentation;
    const currentDocId = searchParams.get("doc");
    if (
      currentDocId === "generating" ||
      currentDocId === String(activeDoc?.id)
    ) {
      editor?.commands.setContent(sanitizeTiptapContent(documentation), {
        emitUpdate: true,
      });
    }

    if (activeDoc?.id) {
      updateSidebarData(activeDoc.id, { urls: validUrls });
    }
  };

  const handleDiscard = () => {
    if (!activeDoc?.id) return;
    setIsDiscardModalOpen(true);
  };

  const handleDiscardConfirm = () => {
    if (activeDoc?.id) clearDraft(activeDoc.id);
    setIsDiscardModalOpen(false);
  };

  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        const currentEditor = editorRef.current;
        if (!currentEditor) return;

        // Check if editor or any of its children are focused
        const isFocused =
          currentEditor.isFocused ||
          currentEditor.view.dom.contains(document.activeElement);
        if (!isFocused) return;

        e.preventDefault();

        if (saveStatusRef.current === SaveStatus.SAVING) return;
        const state = useDocStore.getState();
        if (!state.activeDoc?.id) return;
        if (state.isDocProcessing(state.activeDoc.id)) return;
        if (state.generatingId === "generating" && !state.activeDoc?.id) return;

        saveToSupabase(
          state.activeDoc.id,
          currentEditor.getJSON(),
          state.activeDoc.urls || [],
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToSupabase = async (
    id: string | number,
    content: any,
    _urls: string[],
  ) => {
    setSaveStatus(SaveStatus.SAVING);

    try {
      // Desktop: save content to local storage
      const { localDb_saveContent } = await import("@/services/localDb");
      await localDb_saveContent(id, content);

      // Update the local in-memory state too
      updateSidebarData(id, { content });
      clearDraft(id);

      setSaveStatus(SaveStatus.SAVED);
    } catch (error) {
      console.error("Error saving document:", error);
      setSaveStatus(SaveStatus.ERROR);
    } finally {
      setTimeout(() => setSaveStatus(SaveStatus.IDLE), 2000);
    }
  };

  /** Returns true when the active doc sits inside a "Changeset Summary" folder. */
  const isChangesetSummary = useMemo(() => {
    if (!activeDoc || !activeDoc.parent_id) return false;

    const findNode = (nodes: any[], id: string | number): any => {
      for (const node of nodes) {
        if (String(node.id) === String(id)) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    let currentParentId = activeDoc.parent_id;
    while (currentParentId) {
      const parent = findNode(sidebarData, currentParentId);
      if (!parent) break;
      if (parent.name === "Changeset Summary") return true;
      currentParentId = parent.parent_id;
    }

    return false;
  }, [activeDoc, sidebarData]);

  /** Returns true when the active doc sits inside a "Code Reference" folder. */
  const isCodeRefDoc = useMemo(() => {
    if (!activeDoc || !activeDoc.parent_id) return false;

    const findNode = (nodes: any[], id: string | number): any => {
      for (const node of nodes) {
        if (String(node.id) === String(id)) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    let currentParentId = activeDoc.parent_id;
    while (currentParentId) {
      const parent = findNode(sidebarData, currentParentId);
      if (!parent) break;
      if (parent.name === "Code Reference") return true;
      currentParentId = parent.parent_id;
    }

    return false;
  }, [activeDoc, sidebarData]);

  /**
   * Regenerates a code-reference document by calling the regenerate API,
   * which re-fetches source files from GitHub and rewrites all sections.
   */
  const handleRegenerateCodeDoc = async () => {
    if (!activeDoc?.id) return;

    const docId = activeDoc.id;
    const orgId = activeDoc.organization_id;

    setGeneratingId(docId, activeDoc.parent_id);

    try {
      const res = await fetch("/api/generate-doc/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, organizationId: orgId }),
      });

      let data: any;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server returned an invalid response.");
      }

      if (!res.ok) {
        if (isPlanLimitError(data)) {
          toast.error(data?.error || "Plan limit reached.");
          return;
        }
        throw new Error(data?.error || "Regeneration failed");
      }

      // Update editor and sidebar with newly generated content
      if (data.content && editor) {
        editor.commands.setContent(sanitizeTiptapContent(data.content), {
          emitUpdate: true,
        });
      }

      updateSidebarData(docId, { content: data.content });
      clearDraft(docId);

      toast.success("Document regenerated successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to regenerate document.",
      );
      console.error("[DocNavbar] Regeneration error:", error);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDocSave = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!editor || !activeDoc?.id) return;
    if (saveStatus === SaveStatus.SAVING) return;
    const json = editor.getJSON();
    await saveToSupabase(activeDoc.id, json, activeDoc.urls || []);
  };

  return (
    <>
      <div className="py-3 pl-14 pr-4 md:px-8 w-full flex items-center justify-between absolute bg-secondaryBg z-10 border-b border-border">
        <div className="flex items-center gap-2 md:gap-4">
          {(isChangesetSummary || isCodeRefDoc) && (
            <button
              onClick={
                isCodeRefDoc
                  ? handleRegenerateCodeDoc
                  : () => setIsModalOpen(true)
              }
              disabled={isInteractionDisabled}
              title={
                isCodeRefDoc
                  ? "Regenerate this document from the latest source code"
                  : "Re-generate from a PR or commit URL"
              }
              className={`px-2 md:px-3 gap-1.5 py-1.5 bg-secondaryBg text-sm text-textSecondary hover:text-textPrimary rounded-md hover:bg-secondaryBg/80 transition-colors flex items-center ${isInteractionDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <AutoModeIcon sx={{ fontSize: 18 }} />
              <span className="hidden sm:inline select-none">
                Regenerate Doc
              </span>
            </button>
          )}
        </div>
        <div className="flex gap-3 md:gap-6 items-center justify-center">
          {hasDraft && (
            <button
              onClick={handleDiscard}
              disabled={isInteractionDisabled}
              title="Discard changes"
              className={`px-2 py-1.5 bg-secondaryBg text-sm text-textSecondary hover:text-textPrimary hover:bg-secondaryBg/80 rounded-md transition-colors flex items-center gap-2 ${isInteractionDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <RestartAltIcon sx={{ fontSize: 18 }} />
            </button>
          )}
          <button
            onClick={(event) => handleDocSave(event)}
            disabled={saveStatus === SaveStatus.SAVING || isInteractionDisabled}
            title={`Save (${saveShortcut})`}
            className={`px-3 md:px-4 py-1.5 w-28 rounded-md transition-all flex items-center gap-1.5 md:gap-2 min-w-[80px] md:min-w-[100px] justify-center transform-gpu duration-200 ease-in-out
              ${saveStatus === SaveStatus.SAVING || isInteractionDisabled ? "bg-blue-600/50 cursor-not-allowed opacity-50 text-white" : "bg-blue-600 hover:bg-opacity-80 text-white"}
            `}
          >
            {saveStatus === SaveStatus.SAVING ? (
              <>
                <div className="w-4 h-4 aspect-square border-2 border-t-transparent border-white rounded-full animate-spin" />
                <span className="inline select-none">Saving...</span>
              </>
            ) : saveStatus === SaveStatus.SAVED ? (
              <>
                <CheckOutlinedIcon sx={{ fontSize: 18 }} />
                <span className="inline select-none">Saved</span>
              </>
            ) : (
              <>
                <SaveOutlinedIcon sx={{ fontSize: 18 }} />
                <span className="inline select-none">Save</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Document Generation Input Modal */}
      <GenerateDocModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onOpen={() => setIsModalOpen(true)}
        onSuccess={handleGenerateSuccess}
        isRegenerating={true}
        initialUrls={activeDoc?.urls ?? []}
      />

      {/* Discard Changes Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDiscardModalOpen}
        onClose={() => setIsDiscardModalOpen(false)}
        onConfirm={handleDiscardConfirm}
        title="Discard Changes"
        message="Are you sure you want to discard your unsaved changes? This cannot be undone."
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        variant="primary"
      />
    </>
  );
};

export default DocNavbar;
