/**
 * Centralised route path constants.
 *
 * NEVER hard-code path strings outside this file.
 * All navigate() calls, Link hrefs, and router definitions must use these.
 */
export const ROUTES = {
  /** Main editor / dashboard view */
  HOME: "/",
  /** Alias kept for legacy compatibility & explicit dashboard links */
  DASHBOARD: "/dashboard",
  SETTINGS: "/settings",
  CREATE_ORG: "/create-org",
} as const;

/** Build the URL for opening a specific document in the editor. */
export const docUrl = (docId: string | number) =>
  `${ROUTES.HOME}?doc=${docId}` as const;
