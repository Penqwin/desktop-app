// src/types/sidebar.ts

export type EntityType = "folder" | "file";

export interface SidebarItem {
  id: number | string;
  name: string;
  type: EntityType;
  parent_id: number | string | null;
  user_id: string;
  organization_id: string;
  children?: SidebarItem[];
  isOpen?: boolean;
  content?: any; // Only populated on-demand for the active document
  urls?: string[];
  created_at?: string;
}

// Useful if you want to define data before it has an ID (e.g., in a creation form)
export type CreateEntityDTO = Pick<SidebarItem, "name" | "type" | "parent_id">;
