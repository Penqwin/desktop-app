/**
 * db.ts
 *
 * Dexie (IndexedDB) database definition for the desktop app.
 * Two object stores mirror the old localStorage split:
 *   - sidebarItems  — flat list of sidebar nodes (no content)
 *   - docContents   — TipTap JSON content keyed by document id
 *
 * VERSION HISTORY
 * ───────────────
 * v1 — Initial schema: sidebarItems(id, parent_id), docContents(id)
 * v2 — Added created_at index (caused UnknownError on some clients).
 * v3 — Removes the created_at index. Sorting is done in JS after fetch,
 *       so an IDB index is unnecessary.
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

// Changed to PenqwinDatabase_v2 because a failed index upgrade on Chromium
// can permanently corrupt the underlying IDB file, causing all future
// operations to throw "UnknownError: Internal error". Bumping the name
// bypasses the corrupted database cleanly.
const db = new Dexie("PenqwinDatabase_v2") as Dexie & {
  sidebarItems: EntityTable<SidebarRow, "id">;
  docContents: EntityTable<DocContentRow, "id">;
};

// v1 — original schema
db.version(1).stores({
  sidebarItems: "id, parent_id",
  docContents: "id",
});

// v2 — must precisely match the schema that was deployed, even if it was flawed,
//      so Dexie knows what to upgrade FROM if a user is stuck on v2.
db.version(2).stores({
  sidebarItems: "id, parent_id, created_at",
  docContents: "id",
});

// v3 — stable schema: drops created_at index.
db.version(3).stores({
  sidebarItems: "id, parent_id",
  docContents: "id",
});

// ─── Connection resilience ────────────────────────────────────────────────────
//
// NOTE: We intentionally do NOT add a "versionchange" close handler here.
// In a single-window Electron app there is no legitimate cross-tab upgrade
// scenario. Adding db.close() on versionchange creates a circular failure:
//   versionchange → close → DatabaseClosedError → reopen → versionchange → …
// The "blocked" handler is kept only for diagnostic logging.
db.on("blocked", () => {
  console.warn(
    "[db] Database upgrade blocked by another open connection.",
  );
});

export { db };
