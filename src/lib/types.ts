/**
 * Shared Type Definitions
 *
 * Single source of truth for user data types across the application.
 * Prevents duplicate interfaces and ensures consistency.
 */

/**
 * Complete user profile from database
 * Used by both Supabase Auth and Discord Auth paths
 */
export interface AppUser {
  id: string
  auth_user_id: string
  discord_id: string
  username: string
  avatar: string | null
  role: 'user' | 'moderator' | 'admin'

  // Level system data (SERVER-CONTROLLED - read-only from client)
  level: number
  xp: number
  prestige_level: number
  prestige_stars: { role: 'elf' | 'human'; earnedAt: string }[]
  level_path: 'elf' | 'human'

  // Stats tracking (SERVER-CONTROLLED - read-only from client)
  total_pomodoros: number
  total_study_minutes: number

  // Milestone tracking (SERVER-CONTROLLED - read-only from client)
  total_unique_days: number
  last_pomodoro_date: string | null

  // Login tracking (SERVER-CONTROLLED - read-only from client)
  consecutive_login_days: number
  total_login_days: number
  last_login_date: string | null
  first_login_date: string | null

  // Boost tracking (SERVER-CONTROLLED - read-only from client)
  pomodoro_boost_active: boolean
  pomodoro_boost_expires_at: number | null
  pomodoro_boost_multiplier: number
  last_daily_gift_date: string | null

  // Active buffs (SERVER-CONTROLLED - read-only from client)
  active_buffs: Record<string, {
    value: number;
    expires_at: number | null;
    metadata?: Record<string, any>;
  }>

  // Audio settings (CLIENT-CONTROLLED - read/write)
  sound_enabled: boolean
  volume: number
  music_volume: number

  // System settings (CLIENT-CONTROLLED - read/write)
  level_system_enabled: boolean

  // Timer preferences (CLIENT-CONTROLLED - read/write)
  timer_pomodoro_minutes: number
  timer_short_break_minutes: number
  timer_long_break_minutes: number
  pomodoros_before_long_break: number
  auto_start_breaks: boolean
  auto_start_pomodoros: boolean

  // Visual preferences (CLIENT-CONTROLLED - read/write)
  background_id: string
  background_mobile?: string
  background_desktop?: string
  playlist: 'lofi' | 'synthwave'
  ambient_volumes: Record<string, number>

  // Username change tracking
  last_username_change: string | null

  // Role change tracking (CLIENT-CONTROLLED - cooldown enforcement)
  last_role_change_date: string | null  // ISO date (YYYY-MM-DD)

  // Timezone settings (SERVER-CONTROLLED with 14-day cooldown)
  timezone?: string
  weekend_days?: number[]
  pending_timezone?: string | null
  pending_timezone_applies_at?: string | null
  timezone_updated_at?: string | null
  last_timezone_change_at?: string | null

  // Timestamps
  last_login: string | null
  created_at: string
  updated_at: string
}

/**
 * User settings that can be safely synced from client
 * DOES NOT include XP, levels, or stats (server-controlled)
 */
export interface UserSettings {
  // Timer preferences (6 fields)
  timer_pomodoro_minutes: number
  timer_short_break_minutes: number
  timer_long_break_minutes: number
  pomodoros_before_long_break: number
  auto_start_breaks: boolean
  auto_start_pomodoros: boolean

  // Visual preferences (3 fields)
  background_id: string
  background_mobile?: string
  background_desktop?: string
  playlist: 'lofi' | 'synthwave'
  ambient_volumes: Record<string, number>

  // Audio preferences (3 fields)
  sound_enabled: boolean
  volume: number
  music_volume: number

  // System preferences (1 field)
  level_system_enabled: boolean

  // Level path (visual preference - safe to sync)
  level_path: 'elf' | 'human'
}

/**
 * Stats update request (server-side only)
 * These should ONLY be updated through validated server endpoints
 */
export interface StatsUpdate {
  xp_to_add?: number  // Increment only, validated by server
  pomodoros_to_add?: number  // Increment only, validated by server
  study_minutes_to_add?: number  // Increment only, validated by server
}
