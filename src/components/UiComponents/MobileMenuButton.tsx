import MenuIcon from "@mui/icons-material/Menu";
import { useSidebarOpen } from "@/app/(dashboard)/layout";

/**
 * A hamburger button that opens the sidebar drawer.
 * Visible on mobile only (md:hidden).
 */
export default function MobileMenuButton({ className = "" }: { className?: string }) {
  const openSidebar = useSidebarOpen();

  return (
    <button
      onClick={openSidebar}
      className={`md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-secondaryBg transition-colors flex-shrink-0 ${className}`}
      aria-label="Open sidebar"
    >
      <MenuIcon sx={{ fontSize: 22 }} />
    </button>
  );
}
