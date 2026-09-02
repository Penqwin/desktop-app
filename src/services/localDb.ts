/**
 * localDb.ts
 * 
 * Replaces all Next.js /api/* server routes with localStorage-backed
 * persistence for the desktop Electron app.
 */

import type { SidebarItem } from "@/types/sidebar";

const SIDEBAR_KEY = "penqwin_sidebar";
const CONTENT_PREFIX = "penqwin_content_";

// ─── ID Generation ───────────────────────────────────────────────────────────

let _nextId = Date.now();
function generateId(): number {
  return _nextId++;
}

// ─── Sidebar Data ─────────────────────────────────────────────────────────────

export function localDb_getSidebarItems(): SidebarItem[] {
  try {
    const raw = localStorage.getItem(SIDEBAR_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SidebarItem[];
  } catch {
    return [];
  }
}

function localDb_saveSidebarItems(items: SidebarItem[]): void {
  // Strip content from sidebar items before saving (content is stored separately)
  const stripped = items.map(({ content: _c, ...rest }) => rest);
  localStorage.setItem(SIDEBAR_KEY, JSON.stringify(stripped));
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function localDb_createItem(
  name: string,
  isFolder: boolean,
  parentId: number | string | null,
  content?: any,
): SidebarItem {
  const items = localDb_getSidebarItems();
  const newItem: SidebarItem = {
    id: generateId(),
    name,
    type: isFolder ? "folder" : "file",
    parent_id: parentId ?? null,
    user_id: "local",
    organization_id: "local",
    children: [],
    created_at: new Date().toISOString(),
  };

  items.push(newItem);
  localDb_saveSidebarItems(items);

  // Save content separately
  if (!isFolder && content !== undefined) {
    localDb_saveContent(String(newItem.id), content);
  }

  return newItem;
}

// ─── Read Content ─────────────────────────────────────────────────────────────

export function localDb_getContent(id: string | number): any {
  try {
    const raw = localStorage.getItem(CONTENT_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Save Content ─────────────────────────────────────────────────────────────

export function localDb_saveContent(id: string | number, content: any): void {
  if (content === null || content === undefined) {
    localStorage.removeItem(CONTENT_PREFIX + id);
    return;
  }
  localStorage.setItem(CONTENT_PREFIX + id, JSON.stringify(content));
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function localDb_deleteItems(ids: (string | number)[]): void {
  const items = localDb_getSidebarItems();
  const idSet = new Set(ids.map(String));
  const remaining = items.filter((item) => !idSet.has(String(item.id)));
  localDb_saveSidebarItems(remaining);

  // Also remove content for deleted file items
  ids.forEach((id) => {
    localStorage.removeItem(CONTENT_PREFIX + id);
  });
}

// ─── Rename ───────────────────────────────────────────────────────────────────

export function localDb_renameItem(
  id: string | number,
  newName: string,
): void {
  const items = localDb_getSidebarItems();
  const updated = items.map((item) =>
    String(item.id) === String(id) ? { ...item, name: newName } : item,
  );
  localDb_saveSidebarItems(updated);
}

// ─── Move ─────────────────────────────────────────────────────────────────────

export function localDb_moveItem(
  id: string | number,
  newParentId: string | number | null,
): void {
  const items = localDb_getSidebarItems();
  const updated = items.map((item) =>
    String(item.id) === String(id)
      ? { ...item, parent_id: newParentId }
      : item,
  );
  localDb_saveSidebarItems(updated);
}
