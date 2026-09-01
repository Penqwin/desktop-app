import { create } from "zustand";
import { SidebarItem } from "@/types/sidebar";
import type { ReviewRequestPayload } from "@/types/review";

interface DocState {
  sidebarData: SidebarItem[];
  activeDoc: SidebarItem | null;
  pendingReviewRequest: ReviewRequestPayload | null;
  drafts: Record<string | number, any>; // Stores unsaved content: { docId: content }
  generatingId: string | number | null;
  generationParentId: string | number | null;
  fetchingId: string | number | null;
  creatingItem: { name: string; parentId: string | number | null; type: "file" | "folder" } | null;
  isGenerateModalOpen: boolean;
  creatingTopLevelType: "file" | "folder" | null;
  currentDropTargetId: string | number | null;
  extensionUrl: string | null;
  setSidebarData: (data: SidebarItem[]) => void;
  updateSidebarData: (id: number | string, updatedFields: Partial<SidebarItem> & { content?: any }) => void;
  moveSidebarItem: (id: number | string, newParentId: number | string | null) => void;
  setActiveDoc: (doc: SidebarItem | null) => void;
  setGeneratingId: (id: string | number | null, parentId?: string | number | null) => void;
  setFetchingId: (id: string | number | null) => void;
  setCreatingItem: (item: { name: string; parentId: string | number | null; type: "file" | "folder" } | null) => void;
  setIsGenerateModalOpen: (open: boolean) => void;
  setCreatingTopLevelType: (type: "file" | "folder" | null) => void;
  setCurrentDropTargetId: (id: string | number | null) => void;
  setExtensionUrl: (url: string | null) => void;
  setPendingReviewRequest: (review: ReviewRequestPayload | null) => void;
  setDraft: (id: number | string, content: any) => void;
  clearDraft: (id: number | string) => void;
  fetchDocContent: (id: number | string) => Promise<void>;
  isDocProcessing: (id: number | string) => boolean;
  resetStore: () => void;
}

export const useDocStore = create<DocState>((set, get) => ({
  sidebarData: [],
  activeDoc: null,
  drafts: {},
  generatingId: null,
  generationParentId: null,
  fetchingId: null,
  creatingItem: null,
  isGenerateModalOpen: false,
  creatingTopLevelType: null,
  currentDropTargetId: null,
  extensionUrl: null,
  pendingReviewRequest: null,

  setSidebarData: (data: SidebarItem[]) => set({ sidebarData: data }),
  setGeneratingId: (id, parentId = null) => set({ generatingId: id, generationParentId: parentId }),
  setFetchingId: (id) => set({ fetchingId: id }),
  setCreatingItem: (item) => set({ creatingItem: item }),
  setActiveDoc: (doc) => set({ activeDoc: doc }),
  setIsGenerateModalOpen: (open) => set({ isGenerateModalOpen: open }),
  setCreatingTopLevelType: (type) => set({ creatingTopLevelType: type }),
  setCurrentDropTargetId: (id) => set({ currentDropTargetId: id }),
  setExtensionUrl: (url) => set({ extensionUrl: url }),
  setPendingReviewRequest: (review) => set({ pendingReviewRequest: review }),

  fetchDocContent: async (id: number | string) => {
    const state = get();
    // Cache check: skip if content already exists
    if (state.activeDoc?.id === id && state.activeDoc.content) {
      return;
    }

    set({ fetchingId: id });

    try {
      const response = await fetch(`/api/sidebar-data?id=${id}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Update activeDoc and sidebarData with the fetched content
      const currentActive = get().activeDoc;
      if (currentActive?.id === id) {
        set({
          activeDoc: {
            ...currentActive,
            content: data.content,
            urls: data.urls || [],
          } as SidebarItem,
        });
      }

      // Also update it in the sidebar tree so it's cached for future switches
      set({
        sidebarData: updateNestedItem(get().sidebarData, id, {
          content: data.content,
          urls: data.urls || [],
        }),
      });
    } catch (error) {
      console.error("Failed to fetch doc content:", error);
    } finally {
      set({ fetchingId: null });
    }
  },

  setDraft: (id, content) => set((state) => ({
    drafts: { ...state.drafts, [id]: content }
  })),

  clearDraft: (id) => set((state) => {
    const { [id]: _, ...remainingDrafts } = state.drafts;
    return { drafts: remainingDrafts };
  }),

  updateSidebarData: (id: number | string, updatedFields: Partial<SidebarItem> & { content?: any }) => set((state) => {
    const newSidebarData = updateNestedItem(state.sidebarData, id, updatedFields);
    const newActiveDoc = state.activeDoc?.id === id
      ? { ...state.activeDoc, ...updatedFields } as SidebarItem
      : state.activeDoc;

    return {
      sidebarData: newSidebarData,
      activeDoc: newActiveDoc
    };
  }),
  
  moveSidebarItem: (id: number | string, newParentId: number | string | null) => set((state) => {
    const newSidebarData = updateNestedItem(state.sidebarData, id, { parent_id: newParentId });
    const newActiveDoc = state.activeDoc?.id === id
      ? { ...state.activeDoc, parent_id: newParentId } as SidebarItem
      : state.activeDoc;

    return {
      sidebarData: newSidebarData,
      activeDoc: newActiveDoc
    };
  }),

  isDocProcessing: (id: number | string) => {
    const s = get();
    return String(s.fetchingId) === String(id) || String(s.generatingId) === String(id);
  },

  resetStore: () => set({
    sidebarData: [],
    activeDoc: null,
    drafts: {},
    generatingId: null,
    generationParentId: null,
    fetchingId: null,
    creatingItem: null,
    currentDropTargetId: null,
  })
}));

// Helper to find and update an item in a nested tree
const updateNestedItem = (items: SidebarItem[], id: number | string, fields: Partial<SidebarItem> & { content?: any }): SidebarItem[] => {
  return items.map((item) => {
    const isTarget = String(item.id) === String(id);
    if (isTarget) return { ...item, ...fields } as SidebarItem;
    if (item.children) return { ...item, children: updateNestedItem(item.children, id, fields) };
    return item;
  });
};
