/**
 * UserContext.tsx (Desktop Version)
 * 
 * Replaces the Next.js server-auth UserContext with a minimal
 * local identity for the desktop Electron app. No server required.
 */
import { createContext, useContext, useState, useEffect } from "react";

const LOCAL_USER = {
  id: "local-user",
  email: "local@desktop.app",
  name: "Local User",
};

const LOCAL_ORG = {
  id: "local-org",
  name: "My Workspace",
  user_role: "admin",
  created_by: "local-user",
};

const UserContext = createContext<any>({
  user: LOCAL_USER,
  organization: LOCAL_ORG,
  organizations: [LOCAL_ORG],
  activeOrganization: LOCAL_ORG,
  loading: false,
  setActiveOrganization: () => {},
  createOrganization: async () => {},
  renameOrganization: async () => {},
  deleteOrganization: async () => {},
  refreshProfile: async () => {},
  pendingRequestCounts: {},
  refreshPendingRequests: async () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrganization, setActiveOrganizationState] = useState<any>(null);

  // Load from local storage on mount
  useEffect(() => {
    const storedOrgs = localStorage.getItem("penqwin_organizations");
    const storedActiveId = localStorage.getItem("penqwin_active_org_id");

    let parsedOrgs = [LOCAL_ORG];
    if (storedOrgs) {
      try {
        parsedOrgs = JSON.parse(storedOrgs);
      } catch (e) {
        console.error("Failed to parse organizations from local storage", e);
      }
    } else {
      localStorage.setItem("penqwin_organizations", JSON.stringify(parsedOrgs));
    }

    setOrganizations(parsedOrgs);

    let active = parsedOrgs.find((o: any) => o.id === storedActiveId);
    if (!active) {
      active = parsedOrgs[0];
      localStorage.setItem("penqwin_active_org_id", active.id);
    }
    setActiveOrganizationState(active);
  }, []);

  const setActiveOrganization = (org: any) => {
    setActiveOrganizationState(org);
    localStorage.setItem("penqwin_active_org_id", org.id);
    // Reload the window to ensure all state and DB connections start fresh for the new org
    window.location.href = "/";
  };

  const createOrganization = async (name: string) => {
    const trimmedName = name.trim();
    if (organizations.some((o) => o.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error(`A workspace named "${trimmedName}" already exists.`);
    }

    const newOrg = {
      id: `org_${Date.now()}`,
      name: trimmedName,
      user_role: "admin",
      created_by: LOCAL_USER.id,
    };
    const newOrgs = [...organizations, newOrg];
    setOrganizations(newOrgs);
    localStorage.setItem("penqwin_organizations", JSON.stringify(newOrgs));
    setActiveOrganization(newOrg);
  };

  const renameOrganization = async (orgId: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) throw new Error("Workspace name cannot be empty.");
    
    if (organizations.some((o) => o.id !== orgId && o.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error(`A workspace named "${trimmedName}" already exists.`);
    }

    const newOrgs = organizations.map((o) => 
      o.id === orgId ? { ...o, name: trimmedName } : o
    );

    setOrganizations(newOrgs);
    localStorage.setItem("penqwin_organizations", JSON.stringify(newOrgs));

    if (activeOrganization?.id === orgId) {
      setActiveOrganizationState({ ...activeOrganization, name: trimmedName });
    }
  };

  const deleteOrganization = async (orgId: string) => {
    const newOrgs = organizations.filter((o) => o.id !== orgId);
    
    // Don't allow deleting the last organization
    if (newOrgs.length === 0) {
      console.warn("Cannot delete the last organization");
      return;
    }

    setOrganizations(newOrgs);
    localStorage.setItem("penqwin_organizations", JSON.stringify(newOrgs));
    
    // If the active organization was deleted, switch to the first available one
    if (activeOrganization?.id === orgId) {
      setActiveOrganization(newOrgs[0]);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user: LOCAL_USER,
        organization: activeOrganization,
        organizations,
        activeOrganization,
        loading: !activeOrganization,
        setActiveOrganization,
        createOrganization,
        renameOrganization,
        deleteOrganization,
        refreshProfile: async () => {},
        pendingRequestCounts: {},
        refreshPendingRequests: async () => {},
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
