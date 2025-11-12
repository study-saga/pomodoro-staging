/**
 * Environment detection for Discord Activities vs Browser
 */

export type AppEnvironment = 'discord' | 'browser';

/**
 * Detects whether the app is running in Discord Activities or a regular browser
 */
export function getEnvironment(): AppEnvironment {
  const params = new URLSearchParams(window.location.search);
  const hasDiscordParams = params.has('frame_id') || params.has('instance_id');
  return hasDiscordParams ? 'discord' : 'browser';
}

/**
 * Returns true if the app is running within Discord Activities
 */
export function isInDiscord(): boolean {
  return getEnvironment() === 'discord';
}

/**
 * Returns true if the app is running in a regular browser
 */
export function isInBrowser(): boolean {
  return getEnvironment() === 'browser';
}
