/**
 * Environment detection for Discord Activities vs Browser
 *
 * This module uses URL parameter detection to determine the runtime environment.
 *
 * WHY URL-BASED DETECTION IS SUFFICIENT:
 * - This app is a Discord Activity that ALWAYS runs inside Discord's iframe
 * - Discord always provides frame_id and instance_id query parameters
 * - URL parameters cannot be spoofed in the Discord Activity context (Discord controls the iframe)
 * - Discord SDK is initialized separately in the authentication flow (see discordAuth.ts)
 * - URL detection is synchronous and works reliably for startup checks
 *
 * SECURITY NOTE:
 * While URL parameters could theoretically be spoofed when testing locally,
 * this is not a concern in production because:
 * 1. The app only works when properly embedded in Discord's iframe
 * 2. Authentication via Discord SDK (in discordAuth.ts) provides authoritative verification
 * 3. All sensitive operations require Discord OAuth authentication
 */

export type AppEnvironment = 'discord' | 'browser';

/**
 * Detects whether the app is running in Discord Activities or a regular browser
 *
 * Detection method: Checks for Discord Activity query parameters
 * - frame_id: Discord's iframe identifier
 * - instance_id: Discord Activity instance identifier
 *
 * @returns 'discord' if Discord parameters present, 'browser' otherwise
 */
export function getEnvironment(): AppEnvironment {
  const params = new URLSearchParams(window.location.search)
  const hasDiscordParams = params.has('frame_id') || params.has('instance_id')
  return hasDiscordParams ? 'discord' : 'browser'
}

/**
 * Returns true if the app is running within Discord Activities
 */
export function isInDiscord(): boolean {
  return getEnvironment() === 'discord'
}

/**
 * Returns true if the app is running in a regular browser
 */
export function isInBrowser(): boolean {
  return getEnvironment() === 'browser'
}
