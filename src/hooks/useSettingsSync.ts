import { useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettingsStore } from '../store/useSettingsStore'
import { updateUserPreferences } from '../lib/userSyncAuth'

// Debounce delay in milliseconds
const SYNC_DELAY = 1000

export function useSettingsSync() {
  const { appUser } = useAuth()
  const settings = useSettingsStore()
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoadRef = useRef(true)
  const prevUserIdRef = useRef<string | undefined>(undefined)

  // Load settings from database on mount/login
  useEffect(() => {
    if (!appUser) return

    // Reset flag if user changed (logout/login with different user)
    if (prevUserIdRef.current !== appUser.id) {
      isInitialLoadRef.current = true
      prevUserIdRef.current = appUser.id
    }

    if (!isInitialLoadRef.current) return

    console.log('[Settings Sync] Loading user preferences from database')

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

    // Load ambient volumes (JSONB object)
    if (appUser.ambient_volumes && typeof appUser.ambient_volumes === 'object') {
      Object.entries(appUser.ambient_volumes).forEach(([soundId, volume]) => {
        settings.setAmbientVolume(soundId, volume as number)
      })
    }

    // Load audio preferences (already syncing via Settings component)
    settings.setSoundEnabled(appUser.sound_enabled)
    settings.setVolume(appUser.volume)
    settings.setMusicVolume(appUser.music_volume)

    // Load level system preference
    settings.setLevelSystemEnabled(appUser.level_system_enabled)

    isInitialLoadRef.current = false
  }, [appUser?.id]) // Re-run if user changes (logout/login)

  // Serialize ambientVolumes to stable string for dependency comparison
  // This prevents infinite re-render from object identity changes
  const ambientVolumesKey = useMemo(
    () => JSON.stringify(settings.ambientVolumes),
    [settings.ambientVolumes]
  )

  // Sync settings to database when they change (debounced)
  useEffect(() => {
    // Skip initial load and if no user
    if (isInitialLoadRef.current || !appUser) return

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Debounce: wait for user to finish making changes
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('[Settings Sync] Syncing preferences to database')

        await updateUserPreferences(appUser.id, {
          // Timer preferences
          timer_pomodoro_minutes: settings.timers.pomodoro,
          timer_short_break_minutes: settings.timers.shortBreak,
          timer_long_break_minutes: settings.timers.longBreak,
          pomodoros_before_long_break: settings.pomodorosBeforeLongBreak,
          auto_start_breaks: settings.autoStartBreaks,
          auto_start_pomodoros: settings.autoStartPomodoros,

          // Visual preferences
          background_id: settings.background,
          playlist: settings.playlist,
          ambient_volumes: settings.ambientVolumes,

          // Audio preferences
          sound_enabled: settings.soundEnabled,
          volume: settings.volume,
          music_volume: settings.musicVolume,

          // Level system
          level_system_enabled: settings.levelSystemEnabled
        })

        console.log('[Settings Sync] Preferences synced successfully')
      } catch (error) {
        console.error('[Settings Sync] Failed to sync preferences:', error)
        // Non-fatal: user can continue working, will retry on next change
      }
    }, SYNC_DELAY)

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [
    // Watch all settings that should sync
    appUser?.id,
    settings.timers.pomodoro,
    settings.timers.shortBreak,
    settings.timers.longBreak,
    settings.pomodorosBeforeLongBreak,
    settings.autoStartBreaks,
    settings.autoStartPomodoros,
    settings.background,
    settings.playlist,
    ambientVolumesKey, // Use serialized string instead of object reference
    settings.soundEnabled,
    settings.volume,
    settings.musicVolume,
    settings.levelSystemEnabled
  ])
}
