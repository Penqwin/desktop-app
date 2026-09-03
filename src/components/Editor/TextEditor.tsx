import { useState } from "react";
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

const TextEditor = ({ editor }: any) => {
  const [nested] = useState(true);
  const [isInsideTable, setIsInsideTable] = useState(false);

  if (!editor) {
    return null;
  }

  return (
    <>
      <DragHandle
        editor={editor}
        nested={nested ? NESTED_CONFIG : false}
        onNodeChange={({ node, pos }) => {
          if (!node) {
            setIsInsideTable(false);
            return;
          }

          // Check if node is table related
          const isTableNode = [
            "table",
            "tableRow",
            "tableCell",
            "tableHeader",
          ].includes(node.type.name);

          // Also check if the node is inside a table cell
          const $pos = editor.state.doc.resolve(pos);
          let insideTable = isTableNode;
          for (let d = $pos.depth; d > 0; d--) {
            const ancestor = $pos.node(d);
            if (
              ["table", "tableRow", "tableCell", "tableHeader"].includes(
                ancestor.type.name,
              )
            ) {
              insideTable = true;
              break;
            }
          }

          setIsInsideTable(insideTable);
        }}
      >
        {!isInsideTable && (
          <DragIndicatorIcon
            className="text-textSecondary custom-drag-handle"
            fontSize="small"
          />
        )}
      </DragHandle>

      <EditorContent editor={editor} />

      <BubbleMenuComponent editor={editor} />
      <FloatingMenuComponent editor={editor} />
      <TableContextMenu editor={editor} />
    </>
  );
};

export default TextEditor;
