import { useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettingsStore } from '../store/useSettingsStore'
import { updateUserPreferences } from '../lib/userSyncAuth'
import { supabase } from '../lib/supabase'
import { getEnvironment } from '../lib/environment'

/**
 * Professional Settings Synchronization Hook
 *
 * Strategy:
 * 1. Load from database ONCE on mount
 * 2. Save to localStorage instantly (Zustand persist handles this)
 * 3. Sync to database ONLY when:
 *    - User closes/backgrounds tab (visibilitychange)
 *    - Settings modal closes (manual trigger)
 *    - Periodic sync every 2 minutes IF dirty
 *
 * This reduces syncs from ~100/session to ~5-10/session
 */

// Periodic sync interval (2 minutes)
const PERIODIC_SYNC_INTERVAL = 2 * 60 * 1000

export function useSettingsSync() {
  const { appUser } = useAuth()
  const settings = useSettingsStore()

  // Refs for tracking state
  const isInitialLoadRef = useRef(true)
  const prevUserIdRef = useRef<string | undefined>(undefined)
  const isDirtyRef = useRef(false)
  const lastSyncedStateRef = useRef<string>('')
  const periodicSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const loadGracePeriodRef = useRef(false) // Prevents false dirty flags during load
  const debounceSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check if running in Discord Activity (iframe - unreliable unload events)
  const isDiscordActivity = getEnvironment() === 'discord'

  /**
   * Get fresh store state (avoids stale closure)
   * Critical: sync handlers close over settings from when effect first ran,
   * so we must read fresh state at call time to avoid syncing outdated values
   */
  const getCurrentSettings = () => useSettingsStore.getState()

  /**
   * Serialize ONLY user settings for comparison (14 fields)
   *
   * SECURITY: Only includes settings that are safe for client to control.
   * Does NOT include XP, levels, or stats (server-controlled, read-only from client).
   *
   * Stats/XP/levels are READ from database but NEVER written by client.
   * They're updated ONLY through server-validated endpoints:
   * - atomic_save_completed_pomodoro()
   * - increment_user_xp()
   * - increment_pomodoro_totals()
   */
  const serializeSettings = (settingsOverride?: ReturnType<typeof getCurrentSettings>) => {
    const s = settingsOverride ?? getCurrentSettings()
    return JSON.stringify({
      // Timer preferences (6 fields) - CLIENT-CONTROLLED
      timer_pomodoro_minutes: s.timers.pomodoro,
      timer_short_break_minutes: s.timers.shortBreak,
      timer_long_break_minutes: s.timers.longBreak,
      pomodoros_before_long_break: s.pomodorosBeforeLongBreak,
      auto_start_breaks: s.autoStartBreaks,
      auto_start_pomodoros: s.autoStartPomodoros,

      // Visual preferences (3 fields) - CLIENT-CONTROLLED
      background_id: s.background,
      background_mobile: s.backgroundMobile,
      background_desktop: s.backgroundDesktop,
      playlist: s.playlist,
      ambient_volumes: s.ambientVolumes,

      // Audio preferences (3 fields) - CLIENT-CONTROLLED
      sound_enabled: s.soundEnabled,
      volume: s.volume,
      music_volume: s.musicVolume,

      // System preferences (3 fields) - CLIENT-CONTROLLED
      level_system_enabled: s.levelSystemEnabled,
      level_path: s.levelPath,
      last_role_change_date: s.lastRoleChangeDate

      // NOT INCLUDED (server-controlled, read-only from client):
      // - xp, level, prestige_level
      // - total_pomodoros, total_study_minutes
      // - total_unique_days, last_pomodoro_date
      // - total_login_days, consecutive_login_days, last_login_date
      // - username (has cooldown, needs special handling)
    })
  }

  /**
   * Synchronous sync using Beacon API for unload/unmount scenarios
   * Beacon API is specifically designed for sending data during page unload
   * Falls back to fetch with keepalive if Beacon is unavailable
   */
  const syncSynchronously = (reason: string) => {
    if (!appUser || !isDirtyRef.current) return

    console.log(`[Settings Sync] Syncing synchronously (reason: ${reason})`)

    // Get auth session for JWT token (if available)
    const getSessionAndSync = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        // Get fresh settings state (avoid stale closure)
        const currentSettings = getCurrentSettings()

        // Determine auth mode based on session existence
        const hasSupabaseSession = !!session?.access_token

        // Discord Activity: must have discord_id if no session
        if (!hasSupabaseSession && !appUser.discord_id) {
          console.warn('[Settings Sync] No session and no discord_id - cannot sync')
          return
        }

        // SECURITY: Only send settings (14 fields), NOT stats/XP/levels
        const settingsPayload = {
          // Timer preferences (6 fields)
          p_timer_pomodoro_minutes: currentSettings.timers.pomodoro,
          p_timer_short_break_minutes: currentSettings.timers.shortBreak,
          p_timer_long_break_minutes: currentSettings.timers.longBreak,
          p_pomodoros_before_long_break: currentSettings.pomodorosBeforeLongBreak,
          p_auto_start_breaks: currentSettings.autoStartBreaks,
          p_auto_start_pomodoros: currentSettings.autoStartPomodoros,

          // Visual preferences (3 fields)
          p_background_id: currentSettings.background,
          p_background_mobile: currentSettings.backgroundMobile,
          p_background_desktop: currentSettings.backgroundDesktop,
          p_playlist: currentSettings.playlist,
          p_ambient_volumes: currentSettings.ambientVolumes,

          // Audio preferences (3 fields)
          p_sound_enabled: currentSettings.soundEnabled,
          p_volume: currentSettings.volume,
          p_music_volume: currentSettings.musicVolume,

          // System preferences (3 fields)
          p_level_system_enabled: currentSettings.levelSystemEnabled,
          p_level_path: currentSettings.levelPath,
          p_last_role_change_date: currentSettings.lastRoleChangeDate
        }

        // Build payload based on auth mode
        const payload = hasSupabaseSession
          ? { p_user_id: appUser.id, ...settingsPayload }
          : { p_discord_id: appUser.discord_id, ...settingsPayload }

        // Choose endpoint based on auth mode
        const endpoint = hasSupabaseSession
          ? `${supabaseUrl}/rest/v1/rpc/update_user_settings`
          : `${supabaseUrl}/rest/v1/rpc/update_user_settings_discord`

        // Prepare headers - use JWT for web, anon key for Discord Activity
        const headers = {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': hasSupabaseSession
            ? `Bearer ${session.access_token}`
            : `Bearer ${supabaseAnonKey}`
        }

        // Try Beacon API first (most reliable for page unload)
        // Note: Beacon API doesn't support custom headers, so we use fetch with keepalive instead
        // which is the next best option for reliability
        if (typeof navigator.sendBeacon === 'function') {
          // Beacon doesn't support custom headers, so we can't use it with Supabase auth
          // Fall through to fetch with keepalive
          console.log('[Settings Sync] Beacon API available but requires custom headers, using fetch with keepalive')
        }

        // Use fetch with keepalive (works with custom headers)
        fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          keepalive: true  // Critical: ensures request completes on unload (similar to Beacon)
        }).then(() => {
          // Update state on success (won't run if page already unloaded - that's okay)
          lastSyncedStateRef.current = serializeSettings()
          isDirtyRef.current = false
          console.log('[Settings Sync] ✓ Synced synchronously')
        }).catch((error) => {
          // Log error but don't retry (page is closing anyway)
          console.error('[Settings Sync] Synchronous sync failed:', error)
        })
      } catch (error) {
        console.error('[Settings Sync] Failed to get session for sync:', error)
      }
    }

    // Fire and forget - don't await
    getSessionAndSync()
  }

  // Sync function - only called when needed
  const syncToDatabase = async (reason: string) => {
    if (!appUser || !isDirtyRef.current) return

    try {
      console.log(`[Settings Sync] Syncing to database (reason: ${reason})`)

      // Get fresh settings state (avoid stale closure)
      const currentSettings = getCurrentSettings()

      // SECURITY: Only sync settings (14 fields), NOT stats/XP/levels
      await updateUserPreferences(appUser.id, appUser.discord_id, {
        // Timer preferences (6 fields)
        timer_pomodoro_minutes: currentSettings.timers.pomodoro,
        timer_short_break_minutes: currentSettings.timers.shortBreak,
        timer_long_break_minutes: currentSettings.timers.longBreak,
        pomodoros_before_long_break: currentSettings.pomodorosBeforeLongBreak,
        auto_start_breaks: currentSettings.autoStartBreaks,
        auto_start_pomodoros: currentSettings.autoStartPomodoros,

        // Visual preferences (3 fields)
        background_id: currentSettings.background,
        background_mobile: currentSettings.backgroundMobile,
        background_desktop: currentSettings.backgroundDesktop,
        playlist: currentSettings.playlist,
        ambient_volumes: currentSettings.ambientVolumes,

        // Audio preferences (3 fields)
        sound_enabled: currentSettings.soundEnabled,
        volume: currentSettings.volume,
        music_volume: currentSettings.musicVolume,

        // System preferences (3 fields)
        level_system_enabled: currentSettings.levelSystemEnabled,
        level_path: currentSettings.levelPath,
        last_role_change_date: currentSettings.lastRoleChangeDate
      })

      // Update last synced state and clear dirty flag
      lastSyncedStateRef.current = serializeSettings()
      isDirtyRef.current = false

      console.log('[Settings Sync] ✓ Synced successfully')
    } catch (error) {
      console.error('[Settings Sync] Failed to sync:', error)
      // Keep dirty flag set so we retry later
    }
  }

  // Load settings from database on mount/login (ONCE)
  useEffect(() => {
    if (!appUser) return

    // Reset flag if user changed (logout/login with different user)
    if (prevUserIdRef.current !== appUser.id) {
      isInitialLoadRef.current = true
      prevUserIdRef.current = appUser.id
      isDirtyRef.current = false
      loadGracePeriodRef.current = false // Will be set to true after load
    }

    if (!isInitialLoadRef.current) return

    console.log('[Settings Sync] Loading ALL user data from database (one-time)')

    // Load timer preferences
    settings.setPomodoroDuration(appUser.timer_pomodoro_minutes)
    settings.setShortBreakDuration(appUser.timer_short_break_minutes)
    settings.setLongBreakDuration(appUser.timer_long_break_minutes)
    settings.setPomodorosBeforeLongBreak(appUser.pomodoros_before_long_break)
    settings.setAutoStartBreaks(appUser.auto_start_breaks)
    settings.setAutoStartPomodoros(appUser.auto_start_pomodoros)

    // Load visual preferences
    // setBackground() validates and ensures device-appropriate background
    settings.setBackground(appUser.background_id || 'room-video')

    // Load separate background preferences if they exist
    // We update the store directly for these new fields
    useSettingsStore.setState({
      backgroundMobile: appUser.background_mobile || settings.backgroundMobile,
      backgroundDesktop: appUser.background_desktop || settings.backgroundDesktop
    })

    settings.setPlaylist(appUser.playlist)

    // Load ambient volumes
    if (appUser.ambient_volumes && typeof appUser.ambient_volumes === 'object') {
      Object.entries(appUser.ambient_volumes).forEach(([soundId, volume]) => {
        settings.setAmbientVolume(soundId, volume as number)
      })
    }

    // Load audio preferences
    settings.setSoundEnabled(appUser.sound_enabled)
    settings.setVolume(appUser.volume)
    settings.setMusicVolume(appUser.music_volume)

    // Load system preferences
    settings.setLevelSystemEnabled(appUser.level_system_enabled)

    // Load level system data
    // Server stores total XP, client calculates level/prestige/remaining
    const totalXP = appUser.xp
    const XP_PER_CYCLE = 19000 // Sum(100+200+...+1900) = XP for 1 prestige
    const maxLevel = 20

    // Auto-calculate prestige from total XP
    const calculatedPrestige = Math.floor(totalXP / XP_PER_CYCLE)
    let remainingXP = totalXP % XP_PER_CYCLE

    // Calculate level from remaining XP after prestige
    let calculatedLevel = 1
    while (calculatedLevel < maxLevel && remainingXP >= calculatedLevel * 100) {
      remainingXP -= calculatedLevel * 100
      calculatedLevel++
    }

    useSettingsStore.setState({
      // User identification (for DB operations)
      userId: appUser.id,
      discordId: appUser.discord_id,

      xp: remainingXP,  // Remaining XP towards next level
      level: calculatedLevel,  // Auto-calculated level
      prestigeLevel: calculatedPrestige,  // Auto-calculated prestige
      prestigeStars: appUser.prestige_stars || [],  // Role-specific prestige stars
      totalPomodoros: appUser.total_pomodoros,
      totalStudyMinutes: appUser.total_study_minutes,
      username: appUser.username,
      lastUsernameChange: appUser.last_username_change ? new Date(appUser.last_username_change).getTime() : null,
      levelPath: appUser.level_path,
      lastRoleChangeDate: appUser.last_role_change_date,

      // Milestone tracking
      totalUniqueDays: appUser.total_unique_days,
      lastPomodoroDate: appUser.last_pomodoro_date,

      // Login tracking
      totalLoginDays: appUser.total_login_days,
      consecutiveLoginDays: appUser.consecutive_login_days,
      lastLoginDate: appUser.last_login_date,
      firstLoginDate: appUser.first_login_date || (appUser.created_at ? appUser.created_at.split('T')[0] : null),

      // Boost tracking (Day 10 gift)
      pomodoroBoostActive: appUser.pomodoro_boost_active || false,
      pomodoroBoostExpiresAt: appUser.pomodoro_boost_expires_at || null,

      // Active buffs (from database JSONB) - convert snake_case to camelCase
      activeBuffs: appUser.active_buffs
        ? Object.entries(appUser.active_buffs).reduce((acc, [key, buff]) => {
            acc[key] = {
              value: buff.value,
              expiresAt: buff.expires_at,
              metadata: buff.metadata
            };
            return acc;
          }, {} as Record<string, { value: number; expiresAt: number | null; metadata?: Record<string, any> }>)
        : {}
    })

    // CRITICAL: Set initial synced state from STORE (not from appUser)
    // After loading all settings into store, serialize from actual store state
    // This ensures lastSyncedState exactly matches what's in the store
    // If we serialize from appUser, any default values in store will cause false dirty flags

    // Grace period: wait for Zustand to batch all state updates before serializing
    // This prevents false dirty flags from partially updated state
    loadGracePeriodRef.current = true
    setTimeout(() => {
      // Serialize from store AFTER all updates have settled
      lastSyncedStateRef.current = serializeSettings()
      isDirtyRef.current = false
      loadGracePeriodRef.current = false

      // Mark settings sync as complete - safe to attempt daily gift claim
      useSettingsStore.getState().setSettingsSyncComplete(true)
      console.log('[Settings Sync] ✓ Loaded from database and captured store state')
    }, 100)

    isInitialLoadRef.current = false
  }, [appUser?.id])

  // Track changes and set dirty flag (does NOT sync immediately)
  useEffect(() => {
    if (isInitialLoadRef.current || !appUser || loadGracePeriodRef.current) return

    const currentState = serializeSettings()

    // Only mark dirty if state actually changed
    if (currentState !== lastSyncedStateRef.current) {
      isDirtyRef.current = true
      console.log('[Settings Sync] Settings changed - marked dirty (will sync on trigger)')

      // Sync with 500ms debounce (both web + Discord)
      // Discord: don't rely on unload events in iframe
      // Web: batch rapid changes (e.g. volume slider spam)
      if (debounceSyncRef.current) {
        clearTimeout(debounceSyncRef.current)
      }
      debounceSyncRef.current = setTimeout(() => {
        syncToDatabase(isDiscordActivity ? 'discord-debounced' : 'web-debounced')
      }, 500)

      // Debug: show what changed (only in development)
      if (import.meta.env.DEV) {
        try {
          const current = JSON.parse(currentState)
          const last = JSON.parse(lastSyncedStateRef.current)
          const changes: string[] = []
          Object.keys(current).forEach(key => {
            if (JSON.stringify(current[key]) !== JSON.stringify(last[key])) {
              changes.push(`${key}: ${JSON.stringify(last[key])} → ${JSON.stringify(current[key])}`)
            }
          })
          if (changes.length > 0) {
            console.log('[Settings Sync] Changed fields:', changes.join(', '))
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, [
    appUser?.id,
    // ONLY track CLIENT-CONTROLLED settings (14 fields)
    // Do NOT track server-controlled stats/XP/levels

    // Timer preferences (6 fields)
    settings.timers.pomodoro,
    settings.timers.shortBreak,
    settings.timers.longBreak,
    settings.pomodorosBeforeLongBreak,
    settings.autoStartBreaks,
    settings.autoStartPomodoros,

    // Visual preferences (3 fields)
    settings.background,
    settings.backgroundMobile,
    settings.backgroundDesktop,
    settings.playlist,
    JSON.stringify(settings.ambientVolumes),

    // Audio preferences (3 fields)
    settings.soundEnabled,
    settings.volume,
    settings.musicVolume,

    // System preferences (2 fields)
    settings.levelSystemEnabled,
    settings.levelPath

    // NOT TRACKED (server-controlled, changes don't trigger sync):
    // - xp, level, prestigeLevel
    // - totalPomodoros, totalStudyMinutes
    // - totalUniqueDays, lastPomodoroDate
    // - totalLoginDays, consecutiveLoginDays, lastLoginDate
    // - username
  ])

  // Set up sync triggers
  useEffect(() => {
    if (!appUser) return

    // 1. Sync on page visibility change (going to background)
    const handleVisibilityChange = () => {
      if (document.hidden && isDirtyRef.current) {
        syncToDatabase('visibility-change')
      }
    }

    // 2. Sync on page unload using fetch with keepalive
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        // Use synchronous sync with keepalive to ensure completion even as page closes
        syncSynchronously('page-unload')
      }
    }

    // 3. Periodic sync (every 2 minutes if dirty)
    periodicSyncIntervalRef.current = setInterval(() => {
      if (isDirtyRef.current) {
        syncToDatabase('periodic-2min')
      }
    }, PERIODIC_SYNC_INTERVAL)

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload) // More reliable for iframes

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)

      if (periodicSyncIntervalRef.current) {
        clearInterval(periodicSyncIntervalRef.current)
      }

      // Clear debounce timeout
      if (debounceSyncRef.current) {
        clearTimeout(debounceSyncRef.current)
      }

      // Final sync on unmount using synchronous fetch with keepalive
      // React cleanup is synchronous, so we use fetch with keepalive instead of async/await
      if (isDirtyRef.current && appUser) {
        syncSynchronously('component-unmount')
      }
    }
  }, [appUser?.id])

  // Expose manual sync function for external triggers (e.g., settings modal close)
  useEffect(() => {
    // Make sync function available globally for manual triggers
    (window as any).__syncSettings = () => syncToDatabase('manual-trigger')

    return () => {
      delete (window as any).__syncSettings
    }
  }, [appUser?.id])
}

/**
 * Manual sync trigger for use in components
 * Call this when closing settings modal or after important actions
 */
export function triggerSettingsSync() {
  if ((window as any).__syncSettings) {
    (window as any).__syncSettings()
  }
}
