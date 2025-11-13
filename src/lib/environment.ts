/**
 * Environment detection for Discord Activities vs Browser
 *
 * IMPORTANT: This module provides both synchronous (URL-based) and asynchronous
 * (SDK-based) environment detection. The URL check is a preliminary check;
 * for authoritative detection, use the async detectEnvironment() function.
 */

import { DiscordSDK } from '@discord/embedded-app-sdk'

export type AppEnvironment = 'discord' | 'browser';

// Track Discord SDK initialization state
let discordSdkInstance: DiscordSDK | null = null
let sdkInitialized = false

/**
 * Initialize Discord SDK and verify environment
 * This is the authoritative way to detect Discord environment
 *
 * @returns Promise<'discord' | 'browser'>
 */
export async function detectEnvironment(): Promise<AppEnvironment> {
  // If already initialized, return cached result
  if (sdkInitialized && discordSdkInstance) {
    return 'discord'
  }

  // Try to initialize Discord SDK
  try {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID
    if (!clientId) {
      console.warn('[Environment] Discord Client ID not configured')
      return 'browser'
    }

    discordSdkInstance = new DiscordSDK(clientId)
    await discordSdkInstance.ready()

    sdkInitialized = true
    console.log('[Environment] Discord SDK initialized successfully')
    return 'discord'
  } catch (error) {
    console.log('[Environment] Discord SDK initialization failed, running in browser mode:', error)
    discordSdkInstance = null
    sdkInitialized = false
    return 'browser'
  }
}

/**
 * Get initialized Discord SDK instance
 * Returns null if not in Discord or not initialized yet
 */
export function getDiscordSDK(): DiscordSDK | null {
  return discordSdkInstance
}

/**
 * Check if Discord SDK is ready
 */
export function isDiscordSDKReady(): boolean {
  return sdkInitialized && discordSdkInstance !== null
}

/**
 * Synchronous environment detection (preliminary check)
 *
 * IMPORTANT: This is a quick check based on URL parameters and should not be
 * used as the authoritative detection. For production use, prefer detectEnvironment().
 *
 * This check is useful for:
 * - Quick pre-flight checks before SDK initialization
 * - Synchronous code paths that can't await
 *
 * @deprecated Prefer detectEnvironment() for authoritative detection
 */
export function getEnvironment(): AppEnvironment {
  // First check if SDK is initialized (authoritative)
  if (sdkInitialized && discordSdkInstance) {
    return 'discord'
  }

  // Fallback to URL parameter check (preliminary)
  const params = new URLSearchParams(window.location.search)
  const hasDiscordParams = params.has('frame_id') || params.has('instance_id')
  return hasDiscordParams ? 'discord' : 'browser'
}

/**
 * Returns true if the app is running within Discord Activities
 *
 * IMPORTANT: This is a synchronous check. For authoritative detection,
 * use detectEnvironment() instead.
 *
 * @deprecated Prefer detectEnvironment() for authoritative detection
 */
export function isInDiscord(): boolean {
  return getEnvironment() === 'discord'
}

/**
 * Returns true if the app is running in a regular browser
 *
 * @deprecated Prefer detectEnvironment() for authoritative detection
 */
export function isInBrowser(): boolean {
  return getEnvironment() === 'browser'
}
