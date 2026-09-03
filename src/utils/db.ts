/**
 * db.ts
 *
 * Dexie (IndexedDB) database definition for the desktop app.
 * Two object stores mirror the old localStorage split:
 *   - sidebarItems  — flat list of sidebar nodes (no content)
 *   - docContents   — TipTap JSON content keyed by document id
 */

import Dexie, { type EntityTable } from "dexie";
import type { SidebarItem } from "@/types/sidebar";

// ─── Table shapes ─────────────────────────────────────────────────────────────

export type SidebarRow = Omit<SidebarItem, "content" | "children">;

export interface DocContentRow {
  id: string; // String(SidebarItem.id)
  content: any; // Raw TipTap JSON
}

// ─── Database instance ────────────────────────────────────────────────────────

const db = new Dexie("PenqwinDatabase") as Dexie & {
  sidebarItems: EntityTable<SidebarRow, "id">;
  docContents: EntityTable<DocContentRow, "id">;
};

db.version(1).stores({
  sidebarItems: "id, parent_id",
  docContents: "id",
});

export { db };
