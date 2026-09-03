import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import { useState, useEffect } from "react";
import { IconButton } from "@mui/material";
// icons
import BoldIcon from "@mui/icons-material/FormatBold";
import ItalicIcon from "@mui/icons-material/FormatItalic";
import UnderlineIcon from "@mui/icons-material/FormatUnderlined";
import StrikethroughIcon from "@mui/icons-material/StrikethroughS";
import CodeIcon from "@mui/icons-material/Code";
import QuoteIcon from "@mui/icons-material/FormatQuote";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import TerminalIcon from "@mui/icons-material/Terminal";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import MoreVertIcon from "@mui/icons-material/MoreVert";
// components
import Dropdown from "@/components/UiComponents/Dropdown";
import { isMac, getModifier } from "@/core/utils/platform";

const BubbleMenuComponent = ({ editor }: { editor: any }) => {
  const [modifier, setModifier] = useState("Ctrl");

  useEffect(() => {
    setModifier(getModifier());
  }, []);

  // Subscribe to editor state so the component re-renders on every
  // transaction and editor.isActive() calls return fresh values.
  const editorState = useEditorState({
    editor,
    selector: (ctx: any) => ({
      isBold: ctx.editor.isActive("bold"),
      isItalic: ctx.editor.isActive("italic"),
      isUnderline: ctx.editor.isActive("underline"),
      isStrike: ctx.editor.isActive("strike"),
      isCode: ctx.editor.isActive("code"),
      isBlockquote: ctx.editor.isActive("blockquote"),
      isBulletList: ctx.editor.isActive("bulletList"),
      isOrderedList: ctx.editor.isActive("orderedList"),
      isCodeBlock: ctx.editor.isActive("codeBlock"),
      isHeading1: ctx.editor.isActive("heading", { level: 1 }),
      isHeading2: ctx.editor.isActive("heading", { level: 2 }),
      isHeading3: ctx.editor.isActive("heading", { level: 3 }),
      isHeading4: ctx.editor.isActive("heading", { level: 4 }),
    }),
  });

  if (!editor) {
    return null;
  }

  const headingOptions = [
    { label: "Paragraph", value: "p" },
    { label: "Heading 1", value: "1" },
    { label: "Heading 2", value: "2" },
    { label: "Heading 3", value: "3" },
    { label: "Heading 4", value: "4" },
  ];

  const getCurrentHeading = () => {
    if (editorState?.isHeading1) return "1";
    if (editorState?.isHeading2) return "2";
    if (editorState?.isHeading3) return "3";
    if (editorState?.isHeading4) return "4";
    return "p";
  };

  const handleHeadingChange = (value: string | number) => {
    if (value === "p") {
      editor.chain().focus().setParagraph().run();
    } else {
      editor
        .chain()
        .focus()
        .toggleHeading({ level: parseInt(value as string) })
        .run();
    }
  };

  const moreOptions = [
    { label: "Blockquote", value: "blockquote", icon: QuoteIcon },
    {
      label: "Ordered List",
      value: "orderedList",
      icon: FormatListNumberedIcon,
    },
    { label: "Code Block", value: "codeBlock", icon: TerminalIcon },
    {
      label: "Horizontal Rule",
      value: "horizontalRule",
      icon: HorizontalRuleIcon,
    },
    {
      label: "Clear Formatting",
      value: "clearFormatting",
      icon: FormatClearIcon,
    },
  ];

  const handleMoreChange = (value: string | number) => {
    if (value === "blockquote") {
      editor.chain().focus().toggleBlockquote().run();
    } else if (value === "orderedList") {
      editor.chain().focus().toggleOrderedList().run();
    } else if (value === "codeBlock") {
      editor.chain().focus().toggleCodeBlock().run();
    } else if (value === "horizontalRule") {
      editor.chain().focus().setHorizontalRule().run();
    } else if (value === "clearFormatting") {
      editor.chain().focus().unsetAllMarks().clearNodes().run();
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      className="bg-mainBg px-4 py-2 rounded-xl border border-border relative z-50 flex items-center gap-1 shadow-2xl"
      shouldShow={({ state, view }) => {
        const { selection } = state;

        // Don't show if the editor is not focused
        if (!view.hasFocus()) return false;

        // Don't show if the user is dragging something
        if (view.dragging) return false;

        // Don't show if it's a node selection (e.g. dragging a block via handle)
        if (selection.toJSON().type === "node") return false;

        // Only show for text selections
        return !selection.empty;
      }}
    >
      <Dropdown
        options={headingOptions}
        value={getCurrentHeading()}
        onChange={handleHeadingChange}
      />

      <IconButton
        title={`Bold (${modifier}+B)`}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon
          className={`${editorState?.isBold ? "text-textPrimary" : "text-textSecondary"} hover:text-textPrimary`}
        />
      </IconButton>
      <IconButton
        title={`Italic (${modifier}+I)`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon
          className={`${editorState?.isItalic ? "text-textPrimary" : "text-textSecondary"} hover:text-textPrimary`}
        />
      </IconButton>
      <IconButton
        title={`Underline (${modifier}+U)`}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon
          className={`${editorState?.isUnderline ? "text-textPrimary" : "text-textSecondary"} hover:text-textPrimary`}
        />
      </IconButton>
      <IconButton
        title={`Strikethrough (${modifier}+Shift+X)`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikethroughIcon
          className={`${editorState?.isStrike ? "text-textPrimary" : "text-textSecondary"} hover:text-textPrimary`}
        />
      </IconButton>
      <IconButton
        title={`Code (${modifier}+E)`}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon
          className={`${editorState?.isCode ? "text-textPrimary" : "text-textSecondary"} hover:text-textPrimary`}
        />
      </IconButton>
      <IconButton
        title="Bullet List"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <FormatListBulletedIcon
          className={`${editorState?.isBulletList ? "text-textPrimary" : "text-textSecondary"} hover:text-textPrimary`}
        />
      </IconButton>

      <Dropdown
        options={moreOptions}
        value={""}
        onChange={handleMoreChange}
        hideArrow={true}
        title="More"
        className="!min-w-0 !w-auto"
        headerContent={<MoreVertIcon sx={{ fontSize: 20 }} />}
      />
    </BubbleMenu>
  );
};

export default BubbleMenuComponent;
