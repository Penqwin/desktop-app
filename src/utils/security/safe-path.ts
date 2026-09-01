/**
 * Returns a safe in-app path for post-auth redirects (blocks open redirects).
 */
export function sanitizeInternalPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (next == null || next === "") return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  if (trimmed.includes("@")) return fallback;
  if (/[\s\x00-\x1f\x7f]/.test(trimmed)) return fallback;
  return trimmed;
}
