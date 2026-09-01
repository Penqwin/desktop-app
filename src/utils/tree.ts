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

  // 1. Create a map of all items
  sortedItems.forEach((item) => {
    map[item.id] = { ...item, children: [] };
  });

  // 2. Link children to parents
  sortedItems.forEach((item) => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item.id]);
    } else if (!item.parent_id) {
      // If no parent_id, it's a root item
      tree.push(map[item.id]);
    }
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