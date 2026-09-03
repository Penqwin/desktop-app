import React, { useEffect, useState, useRef } from "react";
// icons
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TableChartIcon from "@mui/icons-material/TableChartOutlined";
import HorizontalSplitOutlinedIcon from "@mui/icons-material/HorizontalSplitOutlined";
import VerticalSplitOutlinedIcon from "@mui/icons-material/VerticalSplitOutlined";

const TableContextMenu = ({ editor }: { editor: any }) => {
  const [menuConfig, setMenuConfig] = useState({ x: 0, y: 0, show: false });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor || !editor.view) return;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if we are clicking inside a table cell
      if (
        target.closest("td") ||
        target.closest("th") ||
        target.closest("table")
      ) {
        e.preventDefault();

        // Calculate position (keep it inside window bounds)
        let x = e.clientX;
        let y = e.clientY;

        // Roughly estimate menu size to prevent clipping
        if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
        if (y + 250 > window.innerHeight) y = window.innerHeight - 260;

        setMenuConfig({ x, y, show: true });
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      // Close menu on any click except inside the menu itself
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      setMenuConfig((prev) => ({ ...prev, show: false }));
    };

    const dom = editor.view.dom as HTMLElement;
    dom.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      dom.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editor]);

  if (!menuConfig.show) return null;

  const handleAction = (action: () => void) => {
    action();
    setMenuConfig((prev) => ({ ...prev, show: false }));
  };

  const options = [
    {
      label: "Add Row Above",
      icon: <KeyboardArrowUpIcon fontSize="small" />,
      action: () => editor.chain().focus().addRowBefore().run(),
    },
    {
      label: "Add Row Below",
      icon: <KeyboardArrowDownIcon fontSize="small" />,
      action: () => editor.chain().focus().addRowAfter().run(),
    },
    {
      label: "Delete Row",
      icon: <HorizontalSplitOutlinedIcon fontSize="small" />,
      action: () => editor.chain().focus().deleteRow().run(),
      danger: true,
    },
    { separator: true },
    {
      label: "Add Column Left",
      icon: <KeyboardArrowLeftIcon fontSize="small" />,
      action: () => editor.chain().focus().addColumnBefore().run(),
    },
    {
      label: "Add Column Right",
      icon: <KeyboardArrowRightIcon fontSize="small" />,
      action: () => editor.chain().focus().addColumnAfter().run(),
    },
    {
      label: "Delete Column",
      icon: <VerticalSplitOutlinedIcon fontSize="small" />,
      action: () => editor.chain().focus().deleteColumn().run(),
      danger: true,
    },
    { separator: true },
    {
      label: "Delete Table",
      icon: <TableChartIcon fontSize="small" />,
      action: () => editor.chain().focus().deleteTable().run(),
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-mainBg border border-border shadow-2xl rounded-lg py-1.5 w-48 flex flex-col"
      style={{ top: menuConfig.y, left: menuConfig.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {options.map((opt, i) => {
        if (opt.separator) {
          return (
            <div key={`sep-${i}`} className="h-px bg-border my-1 w-full" />
          );
        }
        return (
          <button
            key={opt.label}
            onClick={() => handleAction(opt.action!)}
            className={`w-full flex items-center gap-3 px-3 py-1.5 text-sm text-left transition-colors hover:bg-secondaryBg/80 ${
              opt.danger
                ? "text-red-500/90 hover:text-red-500"
                : "text-textSecondary hover:text-textPrimary"
            }`}
          >
            <div className="flex items-center justify-center w-5 h-5">
              {opt.icon}
            </div>
            <span className="font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TableContextMenu;
