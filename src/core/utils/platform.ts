/**
 * Utility to check if the current platform is macOS or iOS.
 * This is useful for determining keyboard shortcuts (Cmd vs Ctrl).
 */
export const isMac = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const platform = navigator.platform?.toLowerCase() || '';
  const userAgent = navigator.userAgent?.toLowerCase() || '';
  
  return (
    platform.includes('mac') ||
    platform.includes('iphone') ||
    platform.includes('ipad') ||
    platform.includes('ipod') ||
    userAgent.includes('mac') ||
    userAgent.includes('iphone') ||
    userAgent.includes('ipad') ||
    userAgent.includes('ipod')
  );
};

/**
 * Returns the appropriate modifier key label for the current platform.
 */
export const getModifier = (): string => {
  return isMac() ? '⌘' : 'Ctrl';
};
