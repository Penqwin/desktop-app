import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DocNavbar from "@/components/DocNavbar";
import { useSidebarOpen } from "@/layouts/DashboardLayout";
// tiptap
import "@/assets/styles/text_editor.css";
import {
  useEditor,
  Extension,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
} from "@tiptap/react";
import TextEditor from "@/components/Editor/TextEditor";
import CodeBlock from "@tiptap/extension-code-block";
import { Markdown } from "tiptap-markdown";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { useDocStore } from "@/store/useDocStore";
import { debounce } from "@/utils/debounce";
import { sanitizeTiptapContent } from "@/utils/sanitizeTiptapContent";
import LoadingDoc from "@/components/UiComponents/LoadingDoc";
import InfoIcon from "@mui/icons-material/Info";

import AutoAwesome from "@mui/icons-material/AutoAwesome";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

const CodeBlockComponent = ({ node }: any) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(node.textContent);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <NodeViewWrapper className="relative group">
      <div
        contentEditable={false}
        className="absolute right-2 top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          onClick={handleCopy}
          className="px-2 py-0.5 bg-[#1a1a1a]/90 border border-[#333] rounded-md text-gray-400 hover:text-white transition-all shadow-sm"
          title="Copy code"
        >
          {copied ? (
            <CheckIcon sx={{ fontSize: 16 }} />
          ) : (
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          )}
        </button>
      </div>
      <pre>
        <NodeViewContent as={"code" as any} />
      </pre>
    </NodeViewWrapper>
  );
};

const CustomCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
});

const CustomShortcuts = Extension.create({
  name: "customShortcuts",
  addKeyboardShortcuts() {
    return {
      "Mod-b": () => this.editor.commands.toggleBold(),
      "Mod-i": () => this.editor.commands.toggleItalic(),
      "Mod-u": () => this.editor.commands.toggleUnderline(),
      "Mod-U": () => this.editor.commands.toggleUnderline(),
      "Mod-Shift-x": () => this.editor.commands.toggleStrike(),
      "Mod-Shift-X": () => this.editor.commands.toggleStrike(),
      "Mod-e": () => this.editor.commands.toggleCode(),
      "Mod-E": () => this.editor.commands.toggleCode(),
    };
  },
});

const EditorPage = () => {
  const activeDoc = useDocStore((state) => state.activeDoc);
  const sidebarData = useDocStore((state) => state.sidebarData);
  const setGeneratingId = useDocStore((state) => state.setGeneratingId);
  const setIsGenerateModalOpen = useDocStore(
    (state) => state.setIsGenerateModalOpen,
  );
  const setCreatingTopLevelType = useDocStore(
    (state) => state.setCreatingTopLevelType,
  );

  const drafts = useDocStore((state) => state.drafts);
  const fetchingId = useDocStore((state) => state.fetchingId);
  const generatingId = useDocStore((state) => state.generatingId);
  const setActiveDoc = useDocStore((state) => state.setActiveDoc);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const openSidebar = useSidebarOpen();
  const docIdParam = searchParams.get("doc");

  // Removed useUser to simplify for desktop app initial port
  const isReadOnly = false;

  const isGeneratingProxy = docIdParam === "generating";
  const isCurrentGenerating =
    (activeDoc?.id && generatingId === activeDoc.id) ||
    isGeneratingProxy ||
    (generatingId === "generating" && !activeDoc);
  const isCurrentDocLoading =
    (activeDoc?.id &&
      (fetchingId === activeDoc.id || generatingId === activeDoc.id)) ||
    isGeneratingProxy ||
    (generatingId === "generating" && !activeDoc);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const debouncedSync = useRef(
    debounce((id: string, currentContent: any, originalContent: any) => {
      const state = useDocStore.getState();
      const isEmptyDoc = (content: any) => {
        if (!content) return true;
        return (
          content.type === "doc" &&
          content.content?.length === 1 &&
          content.content[0].type === "paragraph" &&
          !content.content[0].content
        );
      };

      const isOriginalEmpty = isEmptyDoc(originalContent);
      const isCurrentEmpty = isEmptyDoc(currentContent);

      let isDirty = false;
      if (isOriginalEmpty && isCurrentEmpty) {
        isDirty = false;
      } else {
        isDirty =
          JSON.stringify(currentContent) !== JSON.stringify(originalContent);
      }

      if (isDirty) {
        state.setDraft(id, currentContent);
        // Auto-save to local storage (desktop persistence)
        import("@/services/localDb").then(({ localDb_saveContent }) => {
          localDb_saveContent(id, currentContent);
        });
      } else {
        state.clearDraft(id);
      }
    }, 500),
  ).current;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: {
          openOnClick: false,
          validate: (href: string) => {
            const normalized = href.trim().toLowerCase();
            return (
              normalized.startsWith("http://") ||
              normalized.startsWith("https://") ||
              normalized.startsWith("/") ||
              normalized.startsWith("#") ||
              normalized.startsWith("mailto:")
            );
          },
        },
      }),
      CustomCodeBlock,
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
      }),
      Placeholder.configure({
        placeholder: "Start typing here or press “/” for commands",
        showOnlyCurrent: true,
        includeChildren: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CustomShortcuts,
    ],
    content: "",
    onUpdate: ({ editor }: { editor: any }) => {
      const state = useDocStore.getState();
      const currentActiveDoc = state.activeDoc;
      if (currentActiveDoc?.id) {
        debouncedSync(
          String(currentActiveDoc.id),
          editor.getJSON(),
          currentActiveDoc.content,
        );
      }
    },
    editable: !isReadOnly,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && activeDoc) {
      const contentToSet = drafts[activeDoc.id] || activeDoc.content || "";
      const currentEditorContent = JSON.stringify(editor.getJSON());
      const targetContent = JSON.stringify(contentToSet);

      if (currentEditorContent !== targetContent) {
        setTimeout(() => {
          const { from, to } = editor.state.selection;
          const isFocused = editor.isFocused;

          !contentToSet && editor.commands.focus("start");
          editor.commands.setContent(sanitizeTiptapContent(contentToSet), {
            emitUpdate: false,
          });

          if (isFocused) {
            editor.commands.setTextSelection({ from, to });
          }
        }, 0);
      }
    }
  }, [
    activeDoc?.id,
    activeDoc?.content,
    activeDoc?.id ? drafts[activeDoc.id] : undefined,
    editor,
  ]);

  useEffect(() => {
    if (activeDoc?.id && scrollContainerRef.current) {
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({
          top: 0,
          behavior: "instant",
        });
      });
    }
  }, [activeDoc?.id]);

  useEffect(() => {
    if (docIdParam === "generating" && activeDoc) {
      setActiveDoc(null);
    }
  }, [docIdParam, activeDoc, setActiveDoc]);

  return (
    <div className="relative w-full h-full flex flex-col min-w-0 bg-[#0a0a0a]">
      {!activeDoc && !isCurrentGenerating ? (
        <div className="relative inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden">
          <div className="relative z-10 flex flex-col items-center max-w-lg w-full px-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="mb-12 text-center">
              <img
                src="/assets/penqwin-primary.png"
                alt="Penqwin Logo"
                className="w-60 h-auto mb-6 mx-auto opacity-10 select-none"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>

            {sidebarData.length === 0 ? (
              <div>
                {!isReadOnly && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 md:px-0 w-full">
                    <button
                      onClick={() => {
                        setGeneratingId(null, null);
                        setIsGenerateModalOpen(true);
                      }}
                      className="group select-none relative flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#1a1a1a]/40 border-2 border-[#333]/50 transition-all duration-300 hover:bg-[#1a1a1a]/60 hover:border-[#333] shadow-xl"
                    >
                      <AutoAwesome className="text-gray-400 text-3xl group-hover:text-white" />
                      <span className="text-xs font-bold text-gray-400 group-hover:text-white tracking-tight select-none">
                        Generate Doc
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        openSidebar();
                        setCreatingTopLevelType("file");
                      }}
                      className="group select-none relative flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#1a1a1a]/40 border-2 border-[#333]/50 transition-all duration-300 hover:bg-[#1a1a1a]/60 hover:border-[#333] shadow-xl"
                    >
                      <PostAddOutlinedIcon className="text-gray-400 text-3xl group-hover:text-white" />
                      <span className="text-xs font-bold text-gray-400 group-hover:text-white tracking-tight select-none">
                        New Document
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        openSidebar();
                        setCreatingTopLevelType("folder");
                      }}
                      className="group select-none relative flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#1a1a1a]/40 border-2 border-[#333]/50 transition-all duration-300 hover:bg-[#1a1a1a]/60 hover:border-[#333] shadow-xl"
                    >
                      <CreateNewFolderOutlinedIcon className="text-gray-400 text-3xl group-hover:text-white" />
                      <span className="text-xs font-bold text-gray-400 group-hover:text-white tracking-tight select-none">
                        New Folder
                      </span>
                    </button>
                  </div>
                )}
                <p className="text-xs text-center text-gray-500 mt-6">
                  <ArrowDownwardIcon
                    sx={{ fontSize: "0.85rem", transform: "rotate(90deg)" }}
                    className="inline"
                  />{" "}
                  <span className="select-none">
                    Watch the sidebar to view your creations.
                  </span>
                </p>
              </div>
            ) : (
              <div className="group relative px-6 py-4 rounded-2xl bg-[#1a1a1a]/30 backdrop-blur-2xl border border-[#333] shadow-xl flex items-center gap-4">
                <InfoIcon className="text-blue-500/60 z-10" fontSize="small" />
                <p className="text-sm text-gray-400 font-medium leading-none z-10 select-none">
                  Select a document from the sidebar to begin
                </p>
              </div>
            )}

            <div className="mt-20 flex flex-col items-center gap-2 opacity-30">
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-gray-500">
                Engineering Documentation
              </p>
              <div className="w-1 h-1 rounded-full bg-blue-500/50" />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex relative">
            {!isReadOnly && <DocNavbar editor={editor} />}
          </div>
          <div
            className={`px-4 md:px-8 h-full flex-1 ${isReadOnly ? "" : "pt-16 md:pt-20"}`}
          >
            {isCurrentDocLoading ? (
              <LoadingDoc isGenerating={isCurrentGenerating} />
            ) : (
              <div
                ref={scrollContainerRef}
                className={`pb-20 h-full overflow-y-scroll prose prose-invert max-w-none min-w-0 relative ${isReadOnly ? "pt-10" : ""}`}
              >
                <TextEditor editor={editor} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EditorPage;
