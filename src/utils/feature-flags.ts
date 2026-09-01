/**
 * Feature Flags
 *
 * Control feature availability via environment variables.
 * All flags are safe to read on both server and client (NEXT_PUBLIC_ prefix).
 */

/**
 * When false (default), the app is fully free:
 *   - All plan limit checks are bypassed.
 *   - Every organization is treated as Pro.
 *   - Pricing / billing UI reflects "full access included".
 *
 * Set NEXT_PUBLIC_SUBSCRIPTION_ENABLED=true to restore Polar subscription flow.
 */
export const SUBSCRIPTION_ENABLED =
  process.env.NEXT_PUBLIC_SUBSCRIPTION_ENABLED === "true";
