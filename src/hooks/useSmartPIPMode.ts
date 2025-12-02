import { useEnhancedDeviceType } from './useEnhancedDeviceType'

/**
 * Smart Picture-in-Picture mode detection
 *
 * Returns true ONLY for:
 * - Desktop devices (NOT mobile/tablet)
 * - Discord Activity context
 * - Small viewport (width < threshold)
 *
 * Always returns false for:
 * - Real mobile devices (phones/tablets)
 * - Non-Discord Activity contexts
 * - Large Discord Activity windows
 *
 * @param threshold - PiP width threshold in pixels (default: 750)
 * @returns true if should show PiP mode UI
 */
export function useSmartPIPMode(threshold: number = 750): boolean {
  const { isRealMobile, isDiscordActivity, viewportWidth } = useEnhancedDeviceType()

  // Mobile devices always get full UI (never PiP)
  if (isRealMobile) {
    return false
  }

  // Only apply PiP mode to small Discord Activity windows on desktop
  return isDiscordActivity && viewportWidth < threshold
}
