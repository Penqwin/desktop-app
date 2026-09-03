/**
 * localDb.ts
 *
 * IndexedDB-backed persistence for the desktop Electron app via Dexie.
 * All functions are async — callers must await them.
 */

import type { SidebarItem } from "@/types/sidebar";
import { db, type SidebarRow } from "@/utils/db";

// ─── ID Generation ───────────────────────────────────────────────────────────

let _nextId = Date.now();
function generateId(): number {
  return _nextId++;
}

// ─── Sidebar Data ─────────────────────────────────────────────────────────────

export async function localDb_getSidebarItems(): Promise<SidebarItem[]> {
  try {
    const rows = await db.sidebarItems.toArray();
    // Rehydrate children array expected by the rest of the app
    return rows.map((r) => ({ ...r, children: [] } as SidebarItem));
  } catch {
    return [];
  }
}

async function localDb_saveSidebarItem(row: SidebarRow): Promise<void> {
  await db.sidebarItems.put(row);
}

async function localDb_deleteSidebarItem(id: string): Promise<void> {
  await db.sidebarItems.delete(id);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function localDb_createItem(
  name: string,
  isFolder: boolean,
  parentId: number | string | null,
  content?: any,
): Promise<SidebarItem> {
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

  const { children: _c, content: _ct, ...row } = newItem as any;
  await localDb_saveSidebarItem({ ...row, id: String(newItem.id) });

  // Save content separately
  if (!isFolder && content !== undefined) {
    await localDb_saveContent(String(newItem.id), content);
  }

  return newItem;
}

// ─── Read Content ─────────────────────────────────────────────────────────────

export async function localDb_getContent(id: string | number): Promise<any> {
  try {
    const row = await db.docContents.get(String(id));
    return row?.content ?? null;
  } catch {
    return null;
  }
}

// ─── Save Content ─────────────────────────────────────────────────────────────

export async function localDb_saveContent(
  id: string | number,
  content: any,
): Promise<void> {
  if (content === null || content === undefined) {
    await db.docContents.delete(String(id));
    return;
  }
  await db.docContents.put({ id: String(id), content });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function localDb_deleteItems(
  ids: (string | number)[],
): Promise<void> {
  const strIds = ids.map(String);
  await db.transaction("rw", db.sidebarItems, db.docContents, async () => {
    await db.sidebarItems.bulkDelete(strIds);
    await db.docContents.bulkDelete(strIds);
  });
}

// ─── Rename ───────────────────────────────────────────────────────────────────

export async function localDb_renameItem(
  id: string | number,
  newName: string,
): Promise<void> {
  await db.sidebarItems.update(String(id), { name: newName });
}

// ─── Move ─────────────────────────────────────────────────────────────────────

export async function localDb_moveItem(
  id: string | number,
  newParentId: string | number | null,
): Promise<void> {
  await db.sidebarItems.update(String(id), { parent_id: newParentId });
}
