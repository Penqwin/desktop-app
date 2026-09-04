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

// ─── Workspace Isolation ────────────────────────────────────────────────────────

function getActiveOrgId(): string {
  if (typeof window === "undefined") return "local";
  return localStorage.getItem("penqwin_active_org_id") || "local";
}

// ─── Sidebar Data ─────────────────────────────────────────────────────────────

export async function localDb_getSidebarItems(): Promise<SidebarItem[]> {
  try {
    const activeOrgId = getActiveOrgId();
    const rows = await db.sidebarItems
      .filter(row => row.organization_id === activeOrgId || row.organization_id === "local")
      .toArray();
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
  // Always normalize parent_id to string (or null) so that lookups via
  // String(item.parent_id) === String(currentParentId) are always consistent.
  const normalizedParentId = parentId != null ? String(parentId) : null;

  const newItem: SidebarItem = {
    id: generateId(),
    name,
    type: isFolder ? "folder" : "file",
    parent_id: normalizedParentId,
    user_id: "local",
    organization_id: getActiveOrgId(),
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
  await db.sidebarItems.update(String(id), { parent_id: newParentId != null ? String(newParentId) : null });
}

// ─── Deduplicate Folders ──────────────────────────────────────────────────────

/**
 * Scans the DB for sibling folders with the same name and parent_id, which
 * can arise when the bootstrap process creates duplicates due to a type
 * mismatch in the parent_id comparison (number vs. string).
 *
 * Strategy: keep the folder with the smallest id (oldest), re-parent all
 * children of the duplicates to the kept folder, then delete the duplicates.
 */
export async function localDb_deduplicateFolders(): Promise<number> {
  const rows = await db.sidebarItems.toArray();
  const folders = rows.filter((r) => (r as any).type === "folder");

  // Group by (name, parent_id) — both normalized to strings
  const groups = new Map<string, typeof rows>();
  for (const folder of folders) {
    const key = `${folder.name}||${String((folder as any).parent_id ?? "")}` ;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(folder);
  }

  let deletedCount = 0;

  for (const [, group] of groups) {
    if (group.length <= 1) continue;

    // Sort by id ascending — keep the oldest (smallest numeric id)
    group.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const [keep, ...dupes] = group;
    const keepId = String(keep.id);
    const dupeIds = dupes.map((d) => String(d.id));

    // Re-parent any children of the duplicate folders to the kept folder
    for (const dupeId of dupeIds) {
      const children = rows.filter((r) => String((r as any).parent_id) === dupeId);
      for (const child of children) {
        await db.sidebarItems.update(String(child.id), { parent_id: keepId });
      }
    }

    // Delete the duplicate folders (and their (now empty) content rows)
    await db.sidebarItems.bulkDelete(dupeIds);
    await db.docContents.bulkDelete(dupeIds);
    deletedCount += dupeIds.length;
  }

  return deletedCount;
}
