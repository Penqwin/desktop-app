import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Outlet, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import SideBar from '@/components/SideBar';
import { useDocStore } from '@/store/useDocStore';

interface SidebarContextValue {
  openSidebar: () => void;
  closeSidebar: () => void;
}

export const SidebarContext = createContext<SidebarContextValue>({
  openSidebar: () => {},
  closeSidebar: () => {},
});

export const useSidebarOpen = () => useContext(SidebarContext).openSidebar;
export const useSidebarClose = () => useContext(SidebarContext).closeSidebar;

export default function DashboardLayout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Narrow selector: only need to know if there are ANY docs (for shouldAutoOpen).
  // Using the full sidebarData array here caused DashboardLayout to re-render on
  // every save (sidebarData mutates), which in turn created a new context value
  // object and forced ALL SidebarContext consumers (EditorPage, DocNavbar, etc.)
  // to re-render — ultimately causing TipTap cursor-repositioning glitches via
  // the EditorInstanceManager.compareOptions / setOptions chain.
  const hasDocs = useDocStore((state) => state.sidebarData.length > 0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean | null>(null);

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  // Memoize context value so re-renders of DashboardLayout don't create a new
  // object reference that forces every SidebarContext consumer to re-render.
  // openSidebar and closeSidebar are already stable (useCallback with [] deps),
  // so this memo value never actually changes — it's purely defensive.
  const contextValue = useMemo(
    () => ({ openSidebar, closeSidebar }),
    [openSidebar, closeSidebar],
  );

  const shouldAutoOpen =
    !searchParams.get("doc") &&
    location.pathname === "/" &&
    hasDocs;

  const isEffectivelyOpen =
    isSidebarOpen === true || (isSidebarOpen === null && shouldAutoOpen);

  useEffect(() => {
    const checkAndLock = () => {
      if (window.innerWidth < 768 && isEffectivelyOpen) {
        document.body.classList.add("sidebar-drawer-open");
      } else {
        document.body.classList.remove("sidebar-drawer-open");
      }
    };

    checkAndLock();
    window.addEventListener("resize", checkAndLock);
    return () => {
      window.removeEventListener("resize", checkAndLock);
      document.body.classList.remove("sidebar-drawer-open");
    };
  }, [isEffectivelyOpen]);

  return (
    <SidebarContext.Provider value={contextValue}>
      <div className="flex h-screen overflow-hidden relative bg-[#0a0a0a] text-white">
        <div
          className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
            isEffectivelyOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          onClick={closeSidebar}
          aria-hidden="true"
        />

        <div
          className={`
            fixed inset-y-0 left-0 z-40 flex-shrink-0 transition-transform duration-300 ease-in-out
            md:relative md:translate-x-0 md:z-auto md:flex
            ${
              isSidebarOpen === true
                ? "translate-x-0"
                : isSidebarOpen === false
                  ? "-translate-x-full"
                  : shouldAutoOpen
                    ? "max-md:translate-x-0 -translate-x-full"
                    : "-translate-x-full"
            }
          `}
        >
          <SideBar onClose={closeSidebar} />
        </div>

        <main className="relative flex-1 min-w-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
