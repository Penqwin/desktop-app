import { useRef, memo } from "react";
// icons
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
// tiptap
import { EditorContent } from "@tiptap/react";
import DragHandle from "@tiptap/extension-drag-handle-react";
// components
import BubbleMenuComponent from "@/components/Editor/BubbleMenu";
import FloatingMenuComponent from "@/components/Editor/FloatingMenu";
import TableContextMenu from "@/components/Editor/TableContextMenu";

const NESTED_CONFIG = { edgeDetection: { threshold: -16 } };

const TABLE_NODE_TYPES = new Set(["table", "tableRow", "tableCell", "tableHeader"]);

/**
 * TextEditor is memo-wrapped so re-renders from EditorPage (e.g. Zustand state
 * changes for saves, fetching, etc.) do NOT propagate here. The editor prop is
 * a stable reference from useEditor, so memo effectively shields all TipTap
 * internals from unnecessary React reconciliation.
 *
 * isInsideTable is tracked via a mutable ref + imperative DOM manipulation
 * rather than React state. This completely eliminates the re-render cycle:
 *   onNodeChange → setIsInsideTable → TextEditor re-renders → EditorContent
 *   re-renders → potential cursor disruption during ProseMirror updates.
 */
const TextEditor = memo(({ editor }: any) => {
  // Ref instead of useState: toggling the icon visibility imperatively avoids
  // any React re-render when the user's cursor moves between table / non-table nodes.
  const isInsideTableRef = useRef(false);
  const dragIconWrapperRef = useRef<HTMLSpanElement>(null);

  if (!editor) {
    return null;
  }

  return (
    <>
      <DragHandle
        editor={editor}
        nested={NESTED_CONFIG}
        onNodeChange={({ node, pos }) => {
          let insideTable = false;

          if (node) {
            if (TABLE_NODE_TYPES.has(node.type.name)) {
              insideTable = true;
            } else {
              const $pos = editor.state.doc.resolve(pos);
              for (let d = $pos.depth; d > 0; d--) {
                if (TABLE_NODE_TYPES.has($pos.node(d).type.name)) {
                  insideTable = true;
                  break;
                }
              }
            }
          }

          // Defer to avoid interrupting ProseMirror's transaction dispatch.
          // Use imperative DOM update instead of setState to prevent any
          // React re-render from firing during or after a keypress.
          if (insideTable !== isInsideTableRef.current) {
            requestAnimationFrame(() => {
              isInsideTableRef.current = insideTable;
              if (dragIconWrapperRef.current) {
                dragIconWrapperRef.current.style.display = insideTable ? "none" : "";
              }
            });
          }
        }}
      >
        <span ref={dragIconWrapperRef}>
          <DragIndicatorIcon
            className="text-textSecondary custom-drag-handle"
            fontSize="small"
          />
        </span>
      </DragHandle>

      <EditorContent editor={editor} />

      <BubbleMenuComponent editor={editor} />
      <FloatingMenuComponent editor={editor} />
      <TableContextMenu editor={editor} />
    </>
  );
});

TextEditor.displayName = "TextEditor";

export default TextEditor;
