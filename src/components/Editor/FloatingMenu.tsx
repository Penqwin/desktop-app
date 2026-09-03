import { FloatingMenu } from "@tiptap/react/menus";
import { useEffect, useRef, useState, useCallback } from "react";
// icons
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import TableChartIcon from "@mui/icons-material/TableChartOutlined";

const FloatingMenuComponent = ({ editor }: { editor: any }) => {
  // ── All hooks BEFORE any conditional return ──────────────────────────────
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Ref so event handlers always see the latest index without stale closures
  const selectedIndexRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Scroll highlighted item into view whenever index changes
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // ── Helper: is the menu currently supposed to be visible? ────────────────
  const isMenuVisible = useCallback(() => {
    if (!editor) return false;
    const { state } = editor;
    const { selection } = state;
    if (!selection.empty) return false;
    const { $from } = selection;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, " ");
    return textBefore === "/";
  }, [editor]);

  // ── Execute a menu item (delete slash → apply block type) ────────────────
  const executeItem = useCallback(
    (index: number) => {
      if (!editor) return;
      const menuOptions = buildMenuOptions(editor);
      const item = menuOptions[index];
      if (!item) return;

      // Delete the slash, then apply the block command
      editor
        .chain()
        .deleteRange({
          from: editor.state.selection.from - 1,
          to: editor.state.selection.from,
        })
        .run();
      item.action();
      // Restore focus without triggering a new keydown cycle
      requestAnimationFrame(() => editor.commands.focus());
    },
    [editor],
  );

  // ── Keyboard handler ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isMenuVisible()) return;

      const numOptions = buildMenuOptions(editor).length;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          event.stopImmediatePropagation();
          setSelectedIndex((prev) => (prev + 1) % numOptions);
          break;
        case "ArrowUp":
          event.preventDefault();
          event.stopImmediatePropagation();
          setSelectedIndex((prev) => (prev - 1 + numOptions) % numOptions);
          break;
        case "Enter":
          event.preventDefault();
          event.stopImmediatePropagation();
          // Call directly – NOT inside a setState updater so it runs exactly once
          executeItem(selectedIndexRef.current);
          break;
        case "Escape":
          event.preventDefault();
          event.stopImmediatePropagation();
          editor
            .chain()
            .deleteRange({
              from: editor.state.selection.from - 1,
              to: editor.state.selection.from,
            })
            .run();
          break;
        default:
          break;
      }
    };

    // Block 'insertParagraph' (Enter in contenteditable) via beforeinput too.
    // ProseMirror may listen here independently of keydown.
    const handleBeforeInput = (event: Event) => {
      const ie = event as InputEvent;
      if (ie.inputType === "insertParagraph" && isMenuVisible()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    // Attach both at document capture level so we always run before ProseMirror
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("beforeinput", handleBeforeInput, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("beforeinput", handleBeforeInput, true);
    };
  }, [editor, executeItem, isMenuVisible]);

  // ── Early return after all hooks ─────────────────────────────────────────
  if (!editor) return null;

  const menuOptions = buildMenuOptions(editor);

  return (
    <FloatingMenu
      editor={editor}
      shouldShow={({ state }) => {
        const { selection } = state;
        const { $from } = selection;
        if (!selection.empty) return false;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, " ");
        const show = textBefore === "/";
        if (show) setSelectedIndex(0); // reset highlight when menu opens
        return show;
      }}
      updateDelay={0}
      options={{
        strategy: "absolute",
        placement: "bottom-start",
        flip: { padding: 8 },
        shift: { padding: 12 },
        offset: 12,
      }}
    >
      <div className="flex flex-col bg-mainBg border border-border shadow-2xl rounded-lg overflow-hidden min-w-[180px] z-[100]">
        {menuOptions.map((item, index) => {
          const active = item.isActive();
          const highlighted = index === selectedIndex;
          return (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => executeItem(index)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
                highlighted
                  ? "bg-secondaryBg text-textPrimary"
                  : active
                    ? "bg-secondaryBg/60 text-textPrimary"
                    : "text-textSecondary hover:bg-secondaryBg hover:text-textPrimary"
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md transition-colors">
                {typeof item.icon !== "string" ? (
                  <item.icon sx={{ fontSize: 18 }} />
                ) : (
                  <span className="text-[10px] font-bold">{item.icon}</span>
                )}
              </div>
              <span
                className={`font-semibold ${active || highlighted ? "text-textPrimary" : ""}`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </FloatingMenu>
  );
};

// ── Pure helper: build menu options from editor (outside component) ────────
function buildMenuOptions(editor: any) {
  return [
    {
      label: "Heading 1",
      icon: "H1",
      action: () => editor.chain().setNode("heading", { level: 1 }).run(),
      isActive: () => editor.isActive("heading", { level: 1 }),
    },
    {
      label: "Heading 2",
      icon: "H2",
      action: () => editor.chain().setNode("heading", { level: 2 }).run(),
      isActive: () => editor.isActive("heading", { level: 2 }),
    },
    {
      label: "Bullet List",
      icon: FormatListBulletedIcon,
      action: () => editor.chain().toggleBulletList().run(),
      isActive: () => editor.isActive("bulletList"),
    },
    {
      label: "Quote",
      icon: FormatQuoteIcon,
      action: () => editor.chain().toggleBlockquote().run(),
      isActive: () => editor.isActive("blockquote"),
    },
    {
      label: "Table",
      icon: TableChartIcon,
      action: () =>
        editor
          .chain()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
      isActive: () => editor.isActive("table"),
    },
  ];
}

export default FloatingMenuComponent;
