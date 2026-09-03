import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useSidebarClose } from "@/layouts/DashboardLayout";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
  pointerWithin,
  useDroppable,
  useDndContext,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import TreeItem, { TreeItemRow } from "@/components/SideBar/TreeItem";
import GenerateDocModal from "../UiComponents/GenerateDocModal";
import ReviewDocModal from "../UiComponents/ReviewDocModal";
import { ConfirmationModal } from "../UiComponents/ConfirmationModal";
import GlobalSearch from "../UiComponents/GlobalSearch";
import UpgradeToProModal from "../UiComponents/UpgradeToProModal";
// utils
import { buildTree } from "@/utils/tree";
import { getModifier } from "@/core/utils/platform";
import { isPlanLimitError } from "@/utils/plan-limit";
// store
import { useDocStore } from "@/store/useDocStore";
import { useUser } from "@/core/auth/UserContext";
import {
  localDb_getSidebarItems,
  localDb_createItem,
  localDb_deleteItems,
  localDb_renameItem,
  localDb_moveItem,
} from "@/services/localDb";
// icons
import GearIcon from "@mui/icons-material/SettingsOutlined";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import TextSnippetIcon from "@mui/icons-material/TextSnippetOutlined";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckIcon from "@mui/icons-material/Check";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
// types
import type { SidebarItem } from "@/types/sidebar";

const TopDropZone = ({ activeItem }: { activeItem: any }) => {
  const { setNodeRef, isOver } = useDroppable({ id: "root-top" });
  return (
    <div
      ref={setNodeRef}
      className={`absolute top-0 left-0 right-0 z-40 transition-all duration-300 flex items-center justify-center border-b border-dashed bg-secondaryBg backdrop-blur-md rounded-b-md
        ${activeItem ? "h-16 border-primary/40 shadow-xl opacity-100" : "h-0 border-transparent opacity-0 pointer-events-none"}
        ${isOver ? "bg-primary/20 border-primary border-solid shadow-[0_8px_30px_rgba(0,0,0,0.12)]" : ""}
      `}
    >
      <span
        className={`text-sm font-regular transition-colors text-primary/60 italic ${activeItem ? "opacity-100" : "opacity-0"}`}
      >
        {isOver ? "Release to move to top level" : "Move to top level"}
      </span>
    </div>
  );
};

const BottomDropZone = ({ activeItem }: { activeItem: any }) => {
  const { setNodeRef, isOver } = useDroppable({ id: "root-bottom" });
  return (
    <div
      ref={setNodeRef}
      className={`absolute bottom-0 left-0 right-0 z-40 transition-all duration-300 flex items-center justify-center border-t border-dashed bg-secondaryBg/95 backdrop-blur-md rounded-t-2xl
        ${activeItem ? "h-[90px] border-primary/40 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] opacity-100" : "h-0 border-transparent opacity-0 pointer-events-none"}
        ${isOver ? "bg-primary/20 border-primary border-solid shadow-[0_-12px_30px_rgba(0,0,0,0.15)]" : ""}
      `}
    >
      <span
        className={`text-sm font-regular transition-colors text-primary/60 italic ${activeItem ? "opacity-100" : "opacity-0"}`}
      >
        {isOver ? "Release to move to top level" : "Move to top level"}
      </span>
    </div>
  );
};

const isItemInCodeReference = (
  item: SidebarItem | null,
  allItems: SidebarItem[],
): boolean => {
  if (!item) return false;
  if (item.parent_id === null) {
    return item.type === "folder" && item.name === "Code Reference";
  }
  const parent = allItems.find((i) => String(i.id) === String(item.parent_id));
  return parent ? isItemInCodeReference(parent, allItems) : false;
};

const SideBar = ({ onClose }: { onClose?: () => void }) => {
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isCreateEntityDropdownOpen, setIsCreateEntityDropdownOpen] =
    useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const orgButtonRef = useRef<HTMLDivElement>(null);
  const [dropdownDirection, setDropdownDirection] = useState<"up" | "down">(
    "down",
  );
  const createButtonRef = useRef<HTMLDivElement>(null);
  const [isFetchingSidebarData, setIsFetchingSidebarData] = useState(true);

  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<SidebarItem | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [newTopLevelName, setNewTopLevelName] = useState("");
  const [activeItem, setActiveItem] = useState<SidebarItem | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState(
    "You have reached your Free plan limit.",
  );
  // generationParentId is now in the store

  // data from store
  const sidebarData = useDocStore((state) => state.sidebarData);
  const setSidebarData = useDocStore((state) => state.setSidebarData);
  const activeDoc = useDocStore((state) => state.activeDoc);
  const setActiveDoc = useDocStore((state) => state.setActiveDoc);
  const fetchDocContent = useDocStore((state) => state.fetchDocContent);
  const generatingId = useDocStore((state) => state.generatingId);
  const generationParentId = useDocStore((state) => state.generationParentId);
  const creatingItem = useDocStore((state) => state.creatingItem);
  const setCreatingItem = useDocStore((state) => state.setCreatingItem);
  const isGenerateModalOpen = useDocStore((state) => state.isGenerateModalOpen);
  const setIsGenerateModalOpen = useDocStore(
    (state) => state.setIsGenerateModalOpen,
  );
  const creatingTopLevelType = useDocStore(
    (state) => state.creatingTopLevelType,
  );
  const setCreatingTopLevelType = useDocStore(
    (state) => state.setCreatingTopLevelType,
  );
  const moveSidebarItem = useDocStore((state) => state.moveSidebarItem);
  const extensionUrl = useDocStore((state) => state.extensionUrl);
  const setExtensionUrl = useDocStore((state) => state.setExtensionUrl);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const {
    user,
    organization,
    organizations,
    setActiveOrganization,
    pendingRequestCounts,
  } = useUser();
  const closeSidebar = useSidebarClose();

  const isReadOnly = organization?.user_role === "read only";

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const fetchSidebarData = async () => {
    try {
      setIsFetchingSidebarData(true);
      const data = await localDb_getSidebarItems();
      setSidebarData(data || []);
    } catch (err) {
      console.error("Failed to load local sidebar", err);
    } finally {
      setIsFetchingSidebarData(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchSidebarData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const handleScroll = () => {
      if (el.scrollLeft !== 0) {
        el.scrollLeft = 0;
      }
    };

    el.addEventListener("scroll", handleScroll);
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const docIdParam = searchParams.get("doc");

  useEffect(() => {
    if (sidebarData.length === 0 || !docIdParam) return;

    const docId = docIdParam;
    if (activeDoc?.id === docId) return;

    const foundDoc = sidebarData.find((d) => String(d.id) === String(docId));
    if (foundDoc && foundDoc.type === "file") {
      setActiveDoc(foundDoc);
      fetchDocContent(docId);
    }
  }, [sidebarData, docIdParam, activeDoc?.id, setActiveDoc, fetchDocContent]);

  const setGeneratingId = useDocStore((state) => state.setGeneratingId);

  const nestedData = useMemo(() => {
    let tree = buildTree(sidebarData);

    if (generatingId === "generating") {
      const dummyItem: SidebarItem = {
        id: "generating",
        name: "Generating...",
        type: "file",
        parent_id: generationParentId,
        content: null,
        children: [],
        urls: [],
        user_id: user?.id || "",
        organization_id: organization?.id || 0,
      } as SidebarItem;

      if (!generationParentId) {
        tree.unshift(dummyItem);
      } else if (generationParentId === "changeset-summary-folder") {
        const dummyFolder: SidebarItem = {
          id: "changeset-summary-folder",
          name: "Changeset Summary",
          type: "folder",
          parent_id: null,
          content: null,
          children: [dummyItem],
          urls: [],
          user_id: user?.id || "",
          organization_id: organization?.id || 0,
          isOpen: true,
        } as SidebarItem;
        tree.unshift(dummyFolder);
      } else {
        // Recursively find parent and add dummy
        const insertDummy = (items: SidebarItem[]): SidebarItem[] => {
          return items.map((item) => {
            if (String(item.id) === String(generationParentId)) {
              return {
                ...item,
                children: [dummyItem, ...(item.children || [])],
                isOpen: true, // Auto-expand parent to show generating item
              };
            }
            if (item.children) {
              return { ...item, children: insertDummy(item.children) };
            }
            return item;
          });
        };
        tree = insertDummy(tree);
      }
    }

    if (creatingItem) {
      const dummyItem: SidebarItem = {
        id: "creating",
        name: creatingItem.name,
        type: creatingItem.type,
        parent_id: creatingItem.parentId,
        content: null,
        children: [],
        urls: [],
        user_id: user?.id || "",
        organization_id: organization?.id || 0,
      } as SidebarItem;

      if (!creatingItem.parentId) {
        tree.push(dummyItem);
      } else {
        const insertDummy = (items: SidebarItem[]): SidebarItem[] => {
          return items.map((item) => {
            if (String(item.id) === String(creatingItem.parentId)) {
              return {
                ...item,
                children: [...(item.children || []), dummyItem],
                isOpen: true,
              };
            }
            if (item.children) {
              return { ...item, children: insertDummy(item.children) };
            }
            return item;
          });
        };
        tree = insertDummy(tree);
      }
    }

    return tree;
  }, [sidebarData, generatingId, generationParentId, creatingItem]);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        // Calculate new width (Mouse position - Sidebar left offset)
        const newWidth = mouseMoveEvent.clientX;
        if (newWidth > 150 && newWidth < 600) {
          // Min/Max constraints
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing],
  );

  // Apply desktop dynamic width via ref (avoids fighting Tailwind's w-72 on mobile)
  useEffect(() => {
    if (sidebarRef.current && window.innerWidth >= 768) {
      sidebarRef.current.style.width = `${sidebarWidth}px`;
    }
  }, [sidebarWidth]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const handleEntityCreation = useCallback(
    async (
      parentId: number | string | null,
      isFolder: boolean,
      name: string,
    ) => {
      if (!name) return;

      setCreatingItem({ name, parentId, type: isFolder ? "folder" : "file" });

      try {
        const newEntity = await localDb_createItem(name, isFolder, parentId);
        const preparedNode = { ...newEntity, children: [] };
        setSidebarData([...sidebarData, preparedNode]);

        if (!isFolder) {
          setActiveDoc(preparedNode);
          navigate(`/?doc=${preparedNode.id}`);
        }
        toast.success(
          `${isFolder ? "Folder" : "Document"} created successfully!`,
        );
      } catch (error) {
        console.log(error);
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to create ${isFolder ? "folder" : "document"}`,
        );
      } finally {
        setCreatingItem(null);
      }
    },
    [
      sidebarData,
      setSidebarData,
      setActiveDoc,
      navigate,
      setCreatingItem,
    ],
  );

  const handleEntityAdditon = useCallback(
    (parentId: number | string | null, isFolder: boolean, name: string) => {
      handleEntityCreation(parentId, isFolder, name);
    },
    [handleEntityCreation],
  );

  const handleEntityDeletion = useCallback((item: SidebarItem) => {
    setIsConfirmationModalOpen(true);
    setEntityToDelete(item);
  }, []);

  const getDescendantIds = (
    item: SidebarItem,
    allItems: SidebarItem[],
  ): (number | string)[] => {
    const children = allItems.filter(
      (i) => String(i.parent_id) === String(item.id),
    );
    return [
      item.id,
      ...children.flatMap((child) => getDescendantIds(child, allItems)),
    ];
  };

  const handleEntityDeletionConfirmed = async () => {
    if (entityToDelete) {
      try {
        setIsDeleting(true);
        const idsToDelete = getDescendantIds(entityToDelete, sidebarData);

        await localDb_deleteItems(idsToDelete);
        const idsSet = new Set(idsToDelete.map(String));
        setSidebarData(sidebarData.filter((item) => !idsSet.has(String(item.id))));

        if (activeDoc && idsSet.has(String(activeDoc.id))) {
          setActiveDoc(null);
          navigate("/");
        }

        toast.success("Item deleted successfully");
      } catch (error: any) {
        console.error(error);
        toast.error(error.message || "Failed to delete item");
      } finally {
        setIsDeleting(false);
        setIsConfirmationModalOpen(false);
        setEntityToDelete(null);
      }
    }
  };

  const handleConfirmationModalClose = () => {
    setIsConfirmationModalOpen(false);
    setEntityToDelete(null);
  };

  const handleEntityRename = useCallback(
    async (id: number | string, newName: string) => {
      try {
        await localDb_renameItem(id, newName);
        setSidebarData(
          sidebarData.map((item) =>
            item.id === id ? { ...item, name: newName } : item,
          ),
        );
      } catch (error: any) {
        console.error(error);
        toast.error(error.message || "Failed to rename item");
      }
    },
    [sidebarData, setSidebarData],
  );

  /** Refreshes sidebar data from the server, sets the active doc and fetches its content. */
  const refreshSidebarAndNavigate = useCallback(
    async (targetDocId: string | number) => {
      const freshSidebar = await localDb_getSidebarItems();
      const withChildren = freshSidebar.map((item: any) => ({
        ...item,
        children: [],
      }));
      setSidebarData(withChildren);

      const targetDoc = withChildren.find(
        (item: any) => String(item.id) === String(targetDocId),
      );

      if (targetDoc) {
        setActiveDoc(targetDoc);
        await fetchDocContent(targetDoc.id);
      }
      navigate(`/?doc=${targetDocId}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organization?.id],
  );

  const handleGenerateSuccess = async (data: any, validUrls: string[]) => {
    try {
      if (data.isBootstrap) {
        await fetchSidebarData();
        return;
      }

      // ── UNIFIED PATH: Changeset Summary always present ─────────────────────
      if (data.summaryDocId) {
        await refreshSidebarAndNavigate(data.summaryDocId);
        const count = data.updated?.length || 0;
        toast.success(
          count > 0
            ? `Updated summary and ${count} module doc${count > 1 ? "s" : ""}!`
            : "Changeset Summary generated successfully!",
        );
        return;
      }

      // ── LEGACY PATH: pre-summary flow (fallback) ───────────────────────────
      if (data.updated?.length > 0) {
        await refreshSidebarAndNavigate(data.updated[0].docId);
        const count = data.updated.length;
        toast.success(
          `Updated ${count} doc section${count > 1 ? "s" : ""} successfully!`,
        );
        return;
      }

      // ── LEGACY PATH: single new doc from documentation string ─────────────
      // Response shape: { documentation: string, metadata }
      const documentation = data.documentation;
      const metadata = data.metadata;

      const genParentId = useDocStore.getState().generationParentId;
      const newDoc = await localDb_createItem(metadata.title, false, genParentId, documentation);

      const preparedNode = { ...newDoc, children: [] };
      setSidebarData([...sidebarData, preparedNode]);

      const currentDocId = new URLSearchParams(window.location.search).get("doc");
      if (currentDocId === "generating") {
        setActiveDoc(preparedNode);
        navigate(`/?doc=${preparedNode.id}`);
      }

      toast.success("Documentation generated and saved!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save generated document");
      setGeneratingId(null);
      const currentDocId = new URLSearchParams(window.location.search).get(
        "doc",
      );
      if (currentDocId === "generating") {
        navigate("/dashboard");
      }
    }
  };

  const handleTopLevelCreateSubmit = () => {
    if (newTopLevelName.trim()) {
      handleEntityCreation(
        null,
        creatingTopLevelType === "folder",
        newTopLevelName.trim(),
      );
    }
    setCreatingTopLevelType(null);
    setNewTopLevelName("");
  };

  const handleTopLevelCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTopLevelCreateSubmit();
    } else if (e.key === "Escape") {
      setCreatingTopLevelType(null);
      setNewTopLevelName("");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem(event.active.data.current?.item);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const setCurrentDropTargetId =
      useDocStore.getState().setCurrentDropTargetId;

    if (!over || over.id === "root-top" || over.id === "root-bottom") {
      setCurrentDropTargetId(null);
      return;
    }

    const draggedItem = active.data.current?.item as SidebarItem;
    const dropTarget = over.data.current?.item as SidebarItem;

    if (
      isItemInCodeReference(draggedItem, sidebarData) ||
      isItemInCodeReference(dropTarget, sidebarData)
    ) {
      setCurrentDropTargetId(null);
      return;
    }

    if (dropTarget && draggedItem) {
      const activeDropTargetId =
        dropTarget.type === "folder" ? dropTarget.id : dropTarget.parent_id;

      // Prevent dropping into its own children or itself
      if (String(activeDropTargetId) === String(draggedItem.id)) {
        setCurrentDropTargetId(null);
        return;
      }
      const descendantIds = getDescendantIds(
        draggedItem,
        useDocStore.getState().sidebarData,
      );
      if (
        activeDropTargetId &&
        descendantIds.some((id) => String(id) === String(activeDropTargetId))
      ) {
        setCurrentDropTargetId(null);
        return;
      }

      setCurrentDropTargetId(activeDropTargetId);
    } else {
      setCurrentDropTargetId(null);
    }
  };

  const handleDragCancel = () => {
    const setCurrentDropTargetId =
      useDocStore.getState().setCurrentDropTargetId;
    setCurrentDropTargetId(null);
    setActiveItem(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const setCurrentDropTargetId =
      useDocStore.getState().setCurrentDropTargetId;
    setCurrentDropTargetId(null);
    setActiveItem(null);

    const { active, over } = event;
    if (!over) return;

    const draggedItem = active.data.current?.item as SidebarItem;
    if (!draggedItem) return;

    if (isItemInCodeReference(draggedItem, sidebarData)) {
      toast.error("Cannot move items inside Code Reference folder");
      return;
    }

    let newParentId: string | number | null = null;

    if (over.id === "root-top" || over.id === "root-bottom") {
      newParentId = null;
    } else {
      const dropTarget = over.data.current?.item as SidebarItem;
      if (!dropTarget || String(dropTarget.id) === String(draggedItem.id))
        return;

      if (isItemInCodeReference(dropTarget, sidebarData)) {
        toast.error("Cannot move items into Code Reference folder");
        return;
      }

      newParentId =
        dropTarget.type === "folder" ? dropTarget.id : dropTarget.parent_id;

      // Prevent dropping into its own children
      const descendantIds = getDescendantIds(draggedItem, sidebarData);
      if (
        newParentId &&
        descendantIds.some((id) => String(id) === String(newParentId))
      ) {
        toast.error("Cannot move a folder into its own sub-folder");
        return;
      }
    }

    const isMovingToSameParent =
      (draggedItem.parent_id === null && newParentId === null) ||
      (draggedItem.parent_id !== null &&
        newParentId !== null &&
        String(draggedItem.parent_id) === String(newParentId));

    if (isMovingToSameParent) return;

    // Optimistic Update
    moveSidebarItem(draggedItem.id, newParentId);

    try {
      await localDb_moveItem(draggedItem.id, newParentId);
      toast.success(`Moved "${draggedItem.name}" successfully`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to move item");
      // Rollback on error
      moveSidebarItem(draggedItem.id, draggedItem.parent_id);
    }
  };

  const sidebarListingContent = () => {
    return (
      <div
        ref={container}
        className="flex-1 overflow-y-auto overflow-x-hidden mt-3 custom-scrollbar pr-2 flex flex-col min-h-0"
      >
        <div className="border-none mb-6">
          {nestedData.length === 0 ? (
            isFetchingSidebarData ? (
              <div className="flex flex-col gap-5 mt-4 animate-pulse">
                <div className="h-4 rounded-xl bg-border w-36"></div>
                <div className="h-4 rounded-xl bg-border w-20"></div>
                <div className="h-4 rounded-xl bg-border w-28"></div>
              </div>
            ) : (
              <div className="flex flex-col mt-2 w-full justify-center text-textSecondary">
                <h3 className="text-lg font-semibold text-textSecondary tracking-wide mb-2">
                  Let's begin!
                </h3>
                <p className="max-w-xs text-sm leading-[22px] text-textSecondary tracking-tight mb-6">
                  Engineering excellence is built on clarity.
                  <br />
                  Ready to ship? Start by documenting your latest pull request.
                </p>
              </div>
            )
          ) : (
            <>
              {nestedData.map((item: SidebarItem) => (
                <TreeItem
                  key={item.id}
                  item={item}
                  isReadOnly={isReadOnly}
                  onAdd={handleEntityAdditon}
                  onDelete={handleEntityDeletion}
                  onRename={handleEntityRename}
                />
              ))}
            </>
          )}

          {/* Top Level Inline Output */}
          {creatingTopLevelType && (
            <div className="flex items-center gap-2 py-2 px-2 mt-2">
              <div className="shrink-0 flex items-center text-textSecondary">
                {creatingTopLevelType === "folder" ? (
                  <FolderOpenIcon sx={{ fontSize: 16 }} />
                ) : (
                  <TextSnippetIcon sx={{ fontSize: 16 }} />
                )}
              </div>
              <input
                autoFocus
                className="bg-secondaryBg border border-primary rounded px-1 py-0.5 text-sm w-full outline-none text-textPrimary"
                placeholder={`New ${creatingTopLevelType}`}
                value={newTopLevelName}
                onChange={(e) => setNewTopLevelName(e.target.value)}
                onBlur={handleTopLevelCreateSubmit}
                onKeyDown={handleTopLevelCreateKeyDown}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={sidebarRef}
      className="bg-secondaryBg text-textPrimary relative p-8 pr-4 pb-0 flex flex-col h-screen overflow-hidden w-72"
    >
      {/* Mobile close button + logo row */}
      <div className="flex items-center justify-between flex-shrink-0">
        {/* Penqwin logo */}
        <a href="/" className="text-primary text-2xl font-medium select-none">
          <picture>
            <img
              src="/assets/images/penqwin-primary.webp"
              className="w-16"
              alt="Penqwin"
            />
            <source
              srcSet="/assets/images/penqwin-primary.png"
              type="image/png"
            />
          </picture>
        </a>

        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-textMuted hover:text-textPrimary hover:bg-border transition-colors"
            aria-label="Close sidebar"
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </button>
        )}
      </div>

      <div className="relative flex flex-col flex-1 min-h-0">
        {/* Active org branding */}
        <div
          ref={orgButtonRef}
          className="relative flex items-center gap-2 select-none flex-shrink-0 mt-10 cursor-pointer group"
          onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
        >
          <div className="relative">
            <h1 className="text-textPrimary text-xl leading-5 tracking-tight font-semibold group-hover:text-primary transition-colors">
              {organization?.name || "Select Organization"}
            </h1>
            {!!organization && !!pendingRequestCounts?.[organization.id] && (
              <span className="absolute -top-1.5 -right-2 w-2 h-2 rounded-full bg-info border border-secondaryBg" />
            )}
          </div>
          <ExpandMoreIcon
            sx={{ fontSize: 18 }}
            className={`text-textMuted transition-transform duration-200 ${isOrgDropdownOpen ? "rotate-180" : ""}`}
          />
        </div>

        {/* Org Switcher Dropdown Portal */}
        {mounted &&
          isOrgDropdownOpen &&
          orgButtonRef.current &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[1000]"
                onClick={() => setIsOrgDropdownOpen(false)}
              />
              <div
                className="fixed z-[1001] w-64 bg-secondaryBg border border-border rounded-xl shadow-2xl py-2 overflow-hidden animate-in fade-in zoom-in duration-200"
                style={{
                  top: orgButtonRef.current.getBoundingClientRect().bottom + 8,
                  left: orgButtonRef.current.getBoundingClientRect().left,
                }}
              >
                <div className="px-3 py-1.5 mb-1">
                  <p className="text-[10px] font-bold text-textMuted uppercase tracking-wider">
                    Organizations
                  </p>
                </div>

                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {organizations.map((org: any) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setActiveOrganization(org);
                        setIsOrgDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-border/40 transition-colors text-left text-textSecondary"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-6 h-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                          <BusinessIcon sx={{ fontSize: 14 }} />
                          {!!pendingRequestCounts?.[org.id] && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-info border border-secondaryBg" />
                          )}
                        </div>
                        <span
                          className={`text-sm truncate select-none ${organization?.id === org.id ? "text-textPrimary font-semibold" : "text-textSecondary"}`}
                        >
                          {org.name}
                        </span>
                      </div>
                      {organization?.id === org.id && (
                        <CheckIcon
                          sx={{ fontSize: 14 }}
                          className="text-primary"
                        />
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-2 pt-2 border-t border-border">
                  <button
                    onClick={() => {
                      navigate("/create-org");
                      setIsOrgDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-border/40 transition-colors text-left text-textSecondary hover:text-textPrimary"
                  >
                    <AddIcon sx={{ fontSize: 16 }} />
                    <span className="text-sm select-none">
                      New Organization
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      navigate("/settings");
                      setIsOrgDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-border/40 transition-colors text-left text-textSecondary hover:text-textPrimary"
                  >
                    <div className="relative flex items-center">
                      <GearIcon sx={{ fontSize: 16 }} />
                      {!!organization &&
                        !!pendingRequestCounts?.[organization.id] && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-info border border-secondaryBg" />
                        )}
                    </div>
                    <span className="text-sm select-none">Settings</span>
                  </button>
                </div>
              </div>
            </>,
            document.body,
          )}

        {/* Search Button */}
        {nestedData.length > 0 && (
          <button
            onClick={() => setIsSearchOpen(true)}
            className="mt-4 mb-1 flex items-center group justify-between w-full px-3 py-1.5 bg-secondaryBg border-2 border-border/50 hover:border-border rounded-full text-textMuted transition-colors duration-200 text-sm text-left outline-none focus:outline-none"
          >
            <span className="flex items-center gap-2 group-hover:text-textSecondary select-none">
              <SearchIcon sx={{ fontSize: 18 }} />
              Global Search
            </span>
            <span className="text-xs rounded text-textMuted group-hover:text-textSecondary select-none">
              {getModifier()} + K
            </span>
          </button>
        )}

        {/* Sidebar content listing */}
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          modifiers={[restrictToWindowEdges]}
        >
          <TopDropZone activeItem={activeItem} />
          <BottomDropZone activeItem={activeItem} />
          {sidebarListingContent()}
          <DragOverlay
            adjustScale={false}
            zIndex={1000}
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: "0.4",
                  },
                },
              }),
            }}
          >
            {mounted && activeItem ? (
              <div className="bg-secondaryBg border border-border rounded-md shadow-2xl opacity-90 w-full max-w-[280px] pointer-events-none">
                <TreeItemRow
                  item={activeItem}
                  isAnyDragging={true}
                  pathname={pathname}
                  docIdParam={docIdParam}
                  activeDoc={activeDoc}
                  isGeneratingItem={false}
                  isProcessing={false}
                  isCreatingItem={false}
                  isRenaming={false}
                  newName={""}
                  setNewName={() => {}}
                  handleRenameSubmit={() => {}}
                  handleKeyDown={() => {}}
                  handleClick={() => {}}
                  isOpen={false}
                  hasChildren={false}
                  isCurrentDropTarget={false}
                  isOverNode={false}
                  isReadOnly={isReadOnly}
                />
              </div>
            ) : null}
          </DragOverlay>

          {/* Settings & Create Footer */}
          {!isReadOnly && (
            <div className="py-4 mt-auto flex-shrink-0 flex flex-col">
              <div ref={createButtonRef} className="relative mb-4">
                <button
                  onClick={() => {
                    if (
                      !isCreateEntityDropdownOpen &&
                      createButtonRef.current
                    ) {
                      const rect =
                        createButtonRef.current.getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      // If space below is less than 180px, open up
                      setDropdownDirection(spaceBelow < 180 ? "up" : "down");
                    }
                    setIsCreateEntityDropdownOpen(!isCreateEntityDropdownOpen);
                  }}
                  className="flex items-center justify-center gap-1 text-textSecondary font-medium w-full px-4 py-2 bg-border hover:bg-opacity-50 hover:text-textPrimary rounded-lg transition-all"
                >
                  <AddIcon sx={{ fontSize: 20 }} />
                  <span className="select-none">Create</span>
                </button>

                {mounted && isCreateEntityDropdownOpen && (
                  <div
                    className={`absolute w-full z-[100] ${dropdownDirection === "up" ? "bottom-full mb-2" : "top-full mt-2"}`}
                  >
                    <div
                      className="fixed inset-0 z-[90]"
                      onClick={() => setIsCreateEntityDropdownOpen(false)}
                    />
                    <div className="w-full relative z-[100] flex flex-col bg-secondaryBg border rounded-md border-border shadow-2xl">
                      <button
                        onClick={() => {
                          setCreatingTopLevelType("file");
                          setIsCreateEntityDropdownOpen(false);
                          setNewTopLevelName("");
                        }}
                        className="px-4 py-2 flex items-center gap-2 text-textSecondary hover:text-textPrimary hover:bg-border w-full"
                      >
                        <PostAddOutlinedIcon sx={{ fontSize: 18 }} />
                        <span className="select-none">New Document</span>
                      </button>
                      <button
                        onClick={() => {
                          setCreatingTopLevelType("folder");
                          setIsCreateEntityDropdownOpen(false);
                          setNewTopLevelName("");
                        }}
                        className="px-4 py-2 flex items-center gap-2 text-textSecondary hover:text-textPrimary hover:bg-border w-full"
                      >
                        <CreateNewFolderOutlinedIcon sx={{ fontSize: 18 }} />
                        <span className="select-none">New Folder</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setGeneratingId(null, null);
                  setIsGenerateModalOpen(true);
                }}
                className="flex items-center justify-center gap-2 text-textPrimary font-medium w-full px-4 py-2 bg-primary hover:bg-primary/80 rounded-lg transition-all transform-gpu duration-100 ease-in"
              >
                <AutoAwesome sx={{ fontSize: 20 }} />
                <span className="select-none">
                  {nestedData.some(
                    (item) =>
                      item.name === "Code Reference" && item.type === "folder",
                  )
                    ? "Update Docs"
                    : "Generate docs"}
                </span>
              </button>
            </div>
          )}
        </DndContext>
      </div>

      {/* Resize Handle — desktop only */}
      <div
        className="hidden md:block absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-border transition-colors"
        onMouseDown={startResizing}
      />

      {/* confirmation modal */}
      {mounted &&
        createPortal(
          <ConfirmationModal
            isOpen={isConfirmationModalOpen}
            onClose={handleConfirmationModalClose}
            onConfirm={handleEntityDeletionConfirmed}
            variant="danger"
            isLoading={isDeleting}
            loadingLabel="Deleting..."
            confirmLabel="Delete"
            title="Delete Item"
            message={
              <>
                <div className="text-textPrimary  leading-6">
                  Are you sure you want to delete this{" "}
                  {entityToDelete?.type === "folder" ? "folder" : "document"}{" "}
                  <span className="font-bold">
                    &quot;{entityToDelete?.name}&quot;
                  </span>
                  ?
                </div>
                <div className="text-xs mt-4 leading-5">
                  This action is permanent and cannot be undone.
                </div>
              </>
            }
          />,
          document.body,
        )}

      {mounted && (
        <GlobalSearch
          open={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      )}

      {mounted &&
        createPortal(
          <GenerateDocModal
            isOpen={isGenerateModalOpen}
            onClose={() => {
              setIsGenerateModalOpen(false);
              setExtensionUrl(null);
            }}
            onOpen={() => setIsGenerateModalOpen(true)}
            onPlanLimitReached={(message) => {
              setUpgradeMessage(message || "Upgrade to Pro to continue.");
              setIsUpgradeModalOpen(true);
            }}
            onSuccess={handleGenerateSuccess}
            parentId={generationParentId}
            initialUrls={extensionUrl ? [extensionUrl] : []}
          />,
          document.body,
        )}

      {mounted &&
        createPortal(
          <UpgradeToProModal
            isOpen={isUpgradeModalOpen}
            onClose={() => setIsUpgradeModalOpen(false)}
            message={upgradeMessage}
          />,
          document.body,
        )}

      {mounted &&
        createPortal(
          <ReviewDocModal
            onReviewApplied={async (result) => {
              await handleGenerateSuccess(result, []);
            }}
            onReviewRejected={() => {
              // Optionally handle rejection (e.g., show a notification)
            }}
          />,
          document.body,
        )}
    </div>
  );
};

export default SideBar;
