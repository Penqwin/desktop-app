/**
 * UserContext.tsx (Desktop Version)
 * 
 * Replaces the Next.js server-auth UserContext with a minimal
 * local identity for the desktop Electron app. No server required.
 */
import { createContext, useContext } from "react";

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
  refreshProfile: async () => {},
  pendingRequestCounts: {},
  refreshPendingRequests: async () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <UserContext.Provider
      value={{
        user: LOCAL_USER,
        organization: LOCAL_ORG,
        organizations: [LOCAL_ORG],
        activeOrganization: LOCAL_ORG,
        loading: false,
        setActiveOrganization: () => {},
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
