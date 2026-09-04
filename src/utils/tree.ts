export const buildTree = (items: any[]) => {
  const map: Record<string, any> = {};
  const tree: any[] = [];

  // Sort items uniformly: files before folders, then alphabetical by name.
  // A single, consistent comparator is required — mixing different sort keys
  // for different subsets inside one comparator violates Array.sort's
  // transitivity requirement and can produce unpredictable results in V8.
  const sortedItems = [...items].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "file" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  // 1. Create a map of all items, keyed by stringified id to avoid
  //    number/string type-mismatch (ids are numbers in memory but stored
  //    as strings in IndexedDB, so parent_id lookups would silently fail).
  sortedItems.forEach((item) => {
    map[String(item.id)] = { ...item, children: [] };
  });

  // 2. Link children to parents
  sortedItems.forEach((item) => {
    const parentKey = item.parent_id != null ? String(item.parent_id) : null;
    if (parentKey && map[parentKey]) {
      map[parentKey].children.push(map[String(item.id)]);
    } else if (!parentKey) {
      // If no parent_id, it's a root item
      tree.push(map[String(item.id)]);
    }
    // Note: if parentKey is set but the parent doesn't exist in the map,
    // the item is intentionally omitted (orphaned record) rather than
    // promoted to the root, which previously caused duplication.
  });

  // 3. Post-sort: apply created_at DESC ordering to the children of any
  //    root-level "Changeset Summary" folder. Doing this after tree construction
  //    avoids the transitive-comparator issue entirely.
  tree.forEach((rootItem) => {
    if (
      rootItem.type === "folder" &&
      rootItem.name === "Changeset Summary" &&
      rootItem.children?.length > 1
    ) {
      rootItem.children.sort((a: any, b: any) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate; // newest first
      });
    }
  });

  return tree;
};