/**
 * Recursively sanitizes a TipTap/ProseMirror JSON document tree.
 *
 * ProseMirror enforces that text nodes must have a non-empty string value.
 * Content that originates from external sources (e.g., third-party editors,
 * AI generation, or API payloads) may contain empty text nodes like:
 *   { "type": "text", "text": "" }
 *
 * Passing such content to editor.commands.setContent() throws:
 *   RangeError: Empty text nodes are not allowed
 *
 * This utility strips those nodes before the content reaches the editor.
 */

// Minimal ProseMirror node shape — intentionally local.
// TiptapNode is a universal schema concept that does not belong to any
// specific service. Importing it from `tiptap-section-updater` would:
//   1. Invert the utils → services dependency hierarchy.
//   2. Risk pulling a server-only module into the client bundle
//      (Editor.tsx and DocNavbar.tsx are both ).
type TiptapNode = {
  type: string;
  text?: string;
  content?: TiptapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
};

/**
 * Returns true if the node is an invalid text node.
 * ProseMirror forbids text nodes whose `text` is an empty string or
 * undefined — both cause "RangeError: Empty text nodes are not allowed".
 */
const isInvalidTextNode = (node: TiptapNode): boolean =>
  node.type === "text" && !node.text;

/**
 * Recursively sanitize a ProseMirror-compatible JSON node.
 *
 * - Filters invalid text nodes (empty string or missing `text`) from
 *   `content` arrays.
 * - Recurses into each surviving child node.
 * - Drops `content` entirely when the array is emptied, so block nodes
 *   that normally have no children (e.g. `horizontalRule`) are not given
 *   an unexpected empty array that could trip schema validation.
 */
function sanitizeTiptapNode(node: TiptapNode): TiptapNode {
  if (!node.content?.length) return node;

  const sanitizedContent = node.content
    .filter((child) => !isInvalidTextNode(child))
    .map(sanitizeTiptapNode);

  return {
    ...node,
    // Omit `content` rather than leaving [] when all children were invalid,
    // to avoid schema errors on nodes that do not expect children.
    ...(sanitizedContent.length > 0
      ? { content: sanitizedContent }
      : { content: undefined }),
  };
}

/**
 * Sanitize a full TipTap document JSON object before passing it to
 * `editor.commands.setContent()`.
 *
 * Safe to call with `null`, `undefined`, a string, or any non-object value —
 * those are returned as-is so the editor can apply its own defaults.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeTiptapContent(content: unknown): any {
  if (!content || typeof content !== "object") return content;
  return sanitizeTiptapNode(content as TiptapNode);
}
