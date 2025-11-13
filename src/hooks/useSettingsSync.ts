import { useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettingsStore } from '../store/useSettingsStore'
import { updateUserPreferences } from '../lib/userSyncAuth'

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
  const periodicSyncIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Serialize current settings for comparison
  const serializeSettings = () => {
    return JSON.stringify({
      timer_pomodoro_minutes: settings.timers.pomodoro,
      timer_short_break_minutes: settings.timers.shortBreak,
      timer_long_break_minutes: settings.timers.longBreak,
      pomodoros_before_long_break: settings.pomodorosBeforeLongBreak,
      auto_start_breaks: settings.autoStartBreaks,
      auto_start_pomodoros: settings.autoStartPomodoros,
      background_id: settings.background,
      playlist: settings.playlist,
      ambient_volumes: settings.ambientVolumes,
      sound_enabled: settings.soundEnabled,
      volume: settings.volume,
      music_volume: settings.musicVolume,
      level_system_enabled: settings.levelSystemEnabled
    })
  }

  // Sync function - only called when needed
  const syncToDatabase = async (reason: string) => {
    if (!appUser || !isDirtyRef.current) return

    try {
      console.log(`[Settings Sync] Syncing to database (reason: ${reason})`)

      await updateUserPreferences(appUser.id, {
        timer_pomodoro_minutes: settings.timers.pomodoro,
        timer_short_break_minutes: settings.timers.shortBreak,
        timer_long_break_minutes: settings.timers.longBreak,
        pomodoros_before_long_break: settings.pomodorosBeforeLongBreak,
        auto_start_breaks: settings.autoStartBreaks,
        auto_start_pomodoros: settings.autoStartPomodoros,
        background_id: settings.background,
        playlist: settings.playlist,
        ambient_volumes: settings.ambientVolumes,
        sound_enabled: settings.soundEnabled,
        volume: settings.volume,
        music_volume: settings.musicVolume,
        level_system_enabled: settings.levelSystemEnabled
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
    }

    if (!isInitialLoadRef.current) return

    console.log('[Settings Sync] Loading preferences from database (one-time)')

    // Load timer preferences
    settings.setPomodoroDuration(appUser.timer_pomodoro_minutes)
    settings.setShortBreakDuration(appUser.timer_short_break_minutes)
    settings.setLongBreakDuration(appUser.timer_long_break_minutes)
    settings.setPomodorosBeforeLongBreak(appUser.pomodoros_before_long_break)
    settings.setAutoStartBreaks(appUser.auto_start_breaks)
    settings.setAutoStartPomodoros(appUser.auto_start_pomodoros)

    // Load visual preferences
    settings.setBackground(appUser.background_id)
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

    // Load level system preference
    settings.setLevelSystemEnabled(appUser.level_system_enabled)

    // Set initial synced state
    lastSyncedStateRef.current = serializeSettings()
    isDirtyRef.current = false
    isInitialLoadRef.current = false

    console.log('[Settings Sync] ✓ Loaded from database')
  }, [appUser?.id])

  // Track changes and set dirty flag (does NOT sync immediately)
  useEffect(() => {
    if (isInitialLoadRef.current || !appUser) return

    const currentState = serializeSettings()

    // Only mark dirty if state actually changed
    if (currentState !== lastSyncedStateRef.current) {
      isDirtyRef.current = true
      console.log('[Settings Sync] Settings changed - marked dirty (will sync on trigger)')
    }
  }, [
    appUser?.id,
    settings.timers.pomodoro,
    settings.timers.shortBreak,
    settings.timers.longBreak,
    settings.pomodorosBeforeLongBreak,
    settings.autoStartBreaks,
    settings.autoStartPomodoros,
    settings.background,
    settings.playlist,
    JSON.stringify(settings.ambientVolumes),
    settings.soundEnabled,
    settings.volume,
    settings.musicVolume,
    settings.levelSystemEnabled
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

    // 2. Sync on page unload (less reliable but still useful)
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        // Sync synchronously on unload (beacon API would be better but keep it simple)
        syncToDatabase('page-unload')
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

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)

      if (periodicSyncIntervalRef.current) {
        clearInterval(periodicSyncIntervalRef.current)
      }

      // Final sync on unmount if dirty
      if (isDirtyRef.current) {
        syncToDatabase('component-unmount')
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
