import React, { useState, useEffect, useRef } from "react";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import TextSnippetIcon from "@mui/icons-material/TextSnippetOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useDocStore } from "@/store/useDocStore";
/* Removed next/navigation */
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import { useSidebarClose } from "@/app/(dashboard)/layout";

import { useDraggable, useDroppable, useDndContext } from "@dnd-kit/core";

import { SidebarItem } from "@/types/sidebar";

export const TreeItemRow = ({
  item,
  isAnyDragging,
  pathname,
  docIdParam,
  activeDoc,
  isGeneratingItem,
  isProcessing,
  isCreatingItem,
  isRenaming,
  newName,
  setNewName,
  handleRenameSubmit,
  handleKeyDown,
  handleClick,
  attributes,
  listeners,
  isOpen,
  hasChildren,
  isCurrentDropTarget,
  isOverNode,
}: {
  item: SidebarItem;
  isAnyDragging: boolean;
  pathname: string;
  docIdParam: string | null;
  activeDoc: SidebarItem | null;
  isGeneratingItem: boolean;
  isProcessing: boolean;
  isCreatingItem: boolean;
  isRenaming: boolean;
  newName: string;
  setNewName: (val: string) => void;
  handleRenameSubmit: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleClick: (e: React.MouseEvent) => void;
  attributes?: any;
  listeners?: any;
  isOpen: boolean;
  hasChildren: boolean;
  isCurrentDropTarget: boolean;
  isOverNode: boolean;
  isReadOnly?: boolean;
}) => {
  return (
    <div
      className={`flex items-center w-full gap-2 py-2 px-2 cursor-pointer rounded-md min-w-0 group transition-colors duration-200
        ${!isAnyDragging ? "hover:bg-border hover:text-textPrimary" : ""}
        ${pathname === "/dashboard" && String(docIdParam) === String(item.id) ? "text-primary bg-border/50" : "text-textSecondary"}
        ${isGeneratingItem || isProcessing || isCreatingItem ? "animate-pulse opacity-70 italic" : ""}
        ${isCurrentDropTarget ? "bg-primary/10 ring-1 ring-primary/20" : ""}
        ${isOverNode && !isCurrentDropTarget && item.type === "file" ? "bg-primary/5" : ""}
      `}
      onClick={handleClick}
      {...attributes}
      {...listeners}
      title={item.name || ""}
    >
      {/* Icon container */}
      <div className="shrink-0 relative flex items-center">
        {item.type === "folder" ? (
          <FolderOpenIcon sx={{ fontSize: 16 }} />
        ) : (
          <TextSnippetIcon sx={{ fontSize: 16 }} />
        )}
        {useDocStore.getState().drafts[item.id] && (
          <span
            className={`absolute right-0 bottom-0 inline-block w-2 h-2 rounded-full border border-solid border-secondaryBg shrink-0 ${pathname === "/dashboard" && activeDoc?.id === item.id ? "bg-textSecondary" : "bg-primary"}`}
          />
        )}
      </div>

      {/* Text container / Rename Input */}
      {isRenaming ? (
        <input
          autoFocus
          className="bg-secondaryBg border border-primary rounded px-1 py-0.5 text-sm w-full outline-none text-textPrimary"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="truncate text-sm font-medium flex-1 select-none">
          {item.name}
        </span>
      )}

      {/* Chevron Icon for Folders */}
      {item.type === "folder" && hasChildren && (
        <ExpandMoreIcon
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          sx={{ fontSize: 16 }}
        />
      )}
    </div>
  );
};

const TreeItem = ({
  item,
  isProtected = false,
  onAdd = () => {},
  onDelete = () => {},
  onRename = () => {},
  isReadOnly = false,
}: {
  item: SidebarItem;
  isProtected?: boolean;
  onAdd: (
    parentId: number | string | null,
    isFolder: boolean,
    name: string,
  ) => void;
  onDelete: (item: SidebarItem) => void;
  onRename: (id: number | string, newName: string) => void;
  isReadOnly?: boolean;
}) => {
  const setActiveDoc = useDocStore((state) => state.setActiveDoc);
  const activeDoc = useDocStore((state) => state.activeDoc);
  const fetchDocContent = useDocStore((state) => state.fetchDocContent);
  const isCurrentDropTarget = useDocStore(
    (state) => state.currentDropTargetId === item.id,
  );
  const closeSidebar = useSidebarClose();
  const { active: activeDragItem } = useDndContext();
  const isAnyDragging = !!activeDragItem;

  const isTopLevelChangeset =
    item.parent_id === null &&
    item.type === "folder" &&
    item.name === "Changeset Summary";
  const isTopLevelCodeRef =
    item.parent_id === null &&
    item.type === "folder" &&
    item.name === "Code Reference";

  const isCurrentlyProtected =
    isProtected || isTopLevelChangeset || isTopLevelCodeRef;
  const protectDescendants = isProtected || isTopLevelCodeRef;

  // Local state to manage collapse/expand
  const [isOpen, setIsOpen] = useState(item.isOpen || false);
  const isProcessing = useDocStore((state) => state.isDocProcessing(item.id));
  const isGeneratingItem = item.id === "generating";
  const isCreatingItem = item.id === "creating";
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownDirection, setDropdownDirection] = useState<"up" | "down">(
    "down",
  );
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(item.name);
  const [creatingChildType, setCreatingChildType] = useState<
    "file" | "folder" | null
  >(null);
  const [newEntityName, setNewEntityName] = useState("");

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: item.id,
    disabled:
      isRenaming ||
      isProcessing ||
      isCreatingItem ||
      isGeneratingItem ||
      isReadOnly ||
      isTopLevelCodeRef ||
      isProtected,
    data: { item },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `droppable-${item.id}`,
    disabled:
      isDragging ||
      isTopLevelCodeRef ||
      isProtected,
    data: { item },
  });

  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const docIdParam = searchParams.get("doc");

  const hasChildren = !!(
    item.type === "folder" &&
    item.children &&
    item.children.length > 0
  );

  useEffect(() => {
    if (activeDoc?.parent_id === item.id) {
      setIsOpen(true);
    }
  }, [activeDoc, item.id]);

  // Auto-expand folder when hovered during drag
  useEffect(() => {
    if (isCurrentDropTarget && item.type === "folder" && !isOpen) {
      const timeoutId = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isCurrentDropTarget, item.type, isOpen]);

  const toggleOpen = () => {
    if (item.type === "folder") {
      setIsOpen(!isOpen);
    }
  };
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRenaming || isAnyDragging) return;
    if ((isProcessing && !isGeneratingItem) || isCreatingItem) return; // Prevent clicking while processing
    if (isGeneratingItem) {
      router.push(`/dashboard?doc=generating`);
      // Close sidebar on mobile when navigating
      if (window.innerWidth < 768) closeSidebar();
      return;
    }
    if (item.type === "file") {
      setActiveDoc(item);
      fetchDocContent(item.id);
      router.push(`/dashboard?doc=${item.id}`);
      // Auto-close the sidebar drawer on mobile after selecting a doc
      if (window.innerWidth < 768) closeSidebar();
    } else {
      toggleOpen();
    }
  };

  const handleAction = (e: React.MouseEvent, isFolder: boolean) => {
    e.stopPropagation();
    setShowDropdown(false);
    setCreatingChildType(isFolder ? "folder" : "file");
    setNewEntityName("");
    setIsOpen(true); // Ensure folder is open to see the new input
  };

  const handleCreateSubmit = () => {
    if (newEntityName.trim()) {
      onAdd(item.id, creatingChildType === "folder", newEntityName.trim());
    }
    setCreatingChildType(null);
    setNewEntityName("");
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateSubmit();
    } else if (e.key === "Escape") {
      setCreatingChildType(null);
      setNewEntityName("");
    }
  };

  const hanldeDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    onDelete(item);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    setIsRenaming(true);
    setNewName(item.name);
  };

  const handleRenameSubmit = () => {
    if (newName.trim() && newName.trim() !== item.name) {
      onRename(item.id, newName.trim());
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setNewName(item.name);
    }
  };

  return (
    <div className="ml-2">
      <div
        ref={(node) => {
          setDraggableRef(node);
          setDroppableRef(node);
        }}
        style={style}
        className={`flex items-center group/sidebar-item relative`}
      >
        <TreeItemRow
          item={item}
          isAnyDragging={isAnyDragging}
          pathname={pathname}
          docIdParam={docIdParam}
          activeDoc={activeDoc}
          isGeneratingItem={isGeneratingItem}
          isProcessing={isProcessing}
          isCreatingItem={isCreatingItem}
          isRenaming={isRenaming}
          newName={newName}
          setNewName={setNewName}
          handleRenameSubmit={handleRenameSubmit}
          handleKeyDown={handleKeyDown}
          handleClick={handleClick}
          attributes={attributes}
          listeners={listeners}
          isOpen={isOpen}
          hasChildren={hasChildren}
          isCurrentDropTarget={isCurrentDropTarget}
          isOverNode={isOver}
          isReadOnly={isReadOnly}
        />

        {/* 3-dot Menu Icon */}
        <div className="flex shrink-0">
          {!isGeneratingItem &&
            !isProcessing &&
            !isCreatingItem &&
            !isReadOnly && (
              <button
                ref={menuButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showDropdown && menuButtonRef.current) {
                    const rect = menuButtonRef.current.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    // If space below is less than 250px (menu height), open up
                    setDropdownDirection(spaceBelow < 250 ? "up" : "down");
                  }
                  setShowDropdown(!showDropdown);
                }}
                className="bg-none hover:bg-border px-1.5 py-1 text-textSecondary hover:text-textPrimary aspect-square flex items-center justify-center rounded-md cursor-pointer opacity-100 md:opacity-0 md:group-hover/sidebar-item:opacity-100 transition-opacity"
              >
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </button>
            )}

          {/* Dropdown Menu */}
          {showDropdown && (
            <>
              {/* Invisible overlay to close dropdown when clicking away */}
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDropdown(false);
                }}
              />

              <div
                className={`absolute right-0 z-20 w-48 bg-secondaryBg border border-border rounded-md shadow-2xl text-sm overflow-hidden animate-in fade-in zoom-in duration-100 ${dropdownDirection === "up" ? "bottom-full mb-1" : "top-10 mt-1"}`}
              >
                {item.type === "folder" && (
                  <>
                    <button
                      onClick={(e) => handleAction(e, false)}
                      className="flex items-center gap-2 whitespace-nowrap w-full px-3 py-2.5 hover:bg-border text-textSecondary hover:text-textPrimary transition-colors"
                    >
                      <PostAddOutlinedIcon sx={{ fontSize: 18 }} />
                      <span className="select-none">New Document</span>
                    </button>
                    <button
                      onClick={(e) => handleAction(e, true)}
                      className="flex items-center gap-2 whitespace-nowrap w-full px-3 py-2.5 hover:bg-border text-textSecondary hover:text-textPrimary transition-colors"
                    >
                      <CreateNewFolderOutlinedIcon sx={{ fontSize: 18 }} />
                      <span className="select-none">New Folder</span>
                    </button>
                    <div className="h-[1px] bg-border mx-2 my-1" />
                  </>
                )}
                {!isCurrentlyProtected && (
                  <button
                    onClick={handleRename}
                    className="flex items-center gap-2 whitespace-nowrap w-full px-3 py-2.5 hover:bg-border text-textSecondary hover:text-textPrimary transition-colors"
                  >
                    <DriveFileRenameOutlineIcon sx={{ fontSize: 18 }} />
                    <span className="select-none">Rename</span>
                  </button>
                )}
                <button
                  onClick={(e) => hanldeDelete(e)}
                  className="flex items-center gap-2 whitespace-nowrap w-full px-3 py-2.5 hover:bg-danger/10 text-textSecondary hover:text-danger transition-colors group/delete"
                >
                  <DeleteOutlineOutlinedIcon
                    sx={{ fontSize: 18 }}
                    className="group-hover/delete:text-danger"
                  />
                  <span className="select-none">
                    Delete {item.type === "folder" ? "Folder" : "Document"}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recursive Render / Inline Creation Input */}
      {item.type === "folder" &&
        (creatingChildType || (isOpen && hasChildren)) && (
          <div className="border-l border-border ml-4 mt-0.5">
            {creatingChildType && (
              <div className="flex items-center gap-2 py-2 px-2 ml-2">
                <div className="shrink-0 flex items-center text-textSecondary">
                  {creatingChildType === "folder" ? (
                    <FolderOpenIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <TextSnippetIcon sx={{ fontSize: 16 }} />
                  )}
                </div>
                <input
                  autoFocus
                  className="bg-secondaryBg border border-primary rounded px-1 py-0.5 text-sm w-full outline-none text-textPrimary"
                  placeholder={`New ${creatingChildType}`}
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  onBlur={handleCreateSubmit}
                  onKeyDown={handleCreateKeyDown}
                />
              </div>
            )}
            {hasChildren &&
              isOpen &&
              item.children!.map((child) => (
                <TreeItem
                  key={child.id}
                  item={child}
                  isProtected={protectDescendants}
                  onAdd={onAdd}
                  onDelete={onDelete}
                  onRename={onRename}
                  isReadOnly={isReadOnly}
                />
              ))}
          </div>
        )}
    </div>
  );
};

export default TreeItem;
