/**
 * User Synchronization with Supabase Auth
 *
 * Handles syncing user data from Supabase Auth to the users table
 * with proper security via RLS policies
 */

import { supabase } from './supabase'
import type { AppUser } from './supabaseAuth'

/**
 * Update user's XP atomically
 */
export async function incrementUserXP(userId: string, xpToAdd: number): Promise<void> {
  console.log(`[User Sync] Incrementing XP for user ${userId} by ${xpToAdd}`)

  const { error } = await supabase.rpc('increment_user_xp', {
    p_user_id: userId,
    p_xp_amount: xpToAdd
  })

  if (error) {
    console.error('[User Sync] Error incrementing XP:', error)
    throw new Error('Failed to update XP')
  }

  console.log('[User Sync] XP updated successfully')
}

/**
 * Update user's pomodoro totals atomically
 */
export async function incrementPomodoroTotals(
  userId: string,
  pomodoroCount: number,
  minutes: number
): Promise<void> {
  console.log(`[User Sync] Incrementing pomodoro totals for user ${userId}`)

  const { error } = await supabase.rpc('increment_pomodoro_totals', {
    p_user_id: userId,
    p_pomodoro_count: pomodoroCount,
    p_minutes: minutes
  })

  if (error) {
    console.error('[User Sync] Error incrementing pomodoro totals:', error)
    throw new Error('Failed to update pomodoro statistics')
  }

  console.log('[User Sync] Pomodoro totals updated successfully')
}

/**
 * Update user settings (legacy - use updateUserPreferences for full control)
 */
export async function updateUserSettings(
  userId: string,
  settings: {
    sound_enabled?: boolean
    volume?: number
    music_volume?: number
    level_system_enabled?: boolean
    level_path?: 'elf' | 'human'
  }
): Promise<void> {
  console.log(`[User Sync] Updating settings for user ${userId}`, settings)

  const { error } = await supabase
    .from('users')
    .update({
      ...settings,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    console.error('[User Sync] Error updating settings:', error)
    throw new Error('Failed to update settings')
  }

  console.log('[User Sync] Settings updated successfully')
}

/**
 * Update user preferences (timer, visual, audio) atomically
 * Uses RPC function for atomic updates with authorization check
 */
export async function updateUserPreferences(
  userId: string,
  preferences: {
    // Timer preferences
    timer_pomodoro_minutes?: number
    timer_short_break_minutes?: number
    timer_long_break_minutes?: number
    pomodoros_before_long_break?: number
    auto_start_breaks?: boolean
    auto_start_pomodoros?: boolean

    // Visual preferences
    background_id?: string
    playlist?: 'lofi' | 'synthwave'
    ambient_volumes?: Record<string, number>

    // Audio preferences
    sound_enabled?: boolean
    volume?: number
    music_volume?: number

    // Level system
    level_system_enabled?: boolean
  }
): Promise<AppUser> {
  console.log(`[User Sync] Updating preferences for user ${userId}`, preferences)

  const { data, error } = await supabase.rpc('update_user_preferences', {
    p_user_id: userId,
    p_timer_pomodoro_minutes: preferences.timer_pomodoro_minutes ?? null,
    p_timer_short_break_minutes: preferences.timer_short_break_minutes ?? null,
    p_timer_long_break_minutes: preferences.timer_long_break_minutes ?? null,
    p_pomodoros_before_long_break: preferences.pomodoros_before_long_break ?? null,
    p_auto_start_breaks: preferences.auto_start_breaks ?? null,
    p_auto_start_pomodoros: preferences.auto_start_pomodoros ?? null,
    p_background_id: preferences.background_id ?? null,
    p_playlist: preferences.playlist ?? null,
    p_ambient_volumes: preferences.ambient_volumes ? JSON.stringify(preferences.ambient_volumes) : null,
    p_sound_enabled: preferences.sound_enabled ?? null,
    p_volume: preferences.volume ?? null,
    p_music_volume: preferences.music_volume ?? null,
    p_level_system_enabled: preferences.level_system_enabled ?? null
  })

  if (error) {
    console.error('[User Sync] Error updating preferences:', error)
    throw new Error(`Failed to update preferences: ${error.message}`)
  }

  console.log('[User Sync] Preferences updated successfully')
  return data as AppUser
}

/**
 * Get user by auth user ID
 */
export async function getUserByAuthId(authUserId: string): Promise<AppUser | null> {
  console.log(`[User Sync] Fetching user by auth ID: ${authUserId}`)

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error) {
    console.error('[User Sync] Error fetching user:', error)
    throw new Error('Failed to fetch user')
  }

  return data as AppUser | null
}

/**
 * Update user login streak
 */
export async function updateLoginStreak(userId: string): Promise<void> {
  console.log(`[User Sync] Updating login streak for user ${userId}`)

  // Fetch current user to check last login date
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('last_login_date, consecutive_login_days, total_unique_days')
    .eq('id', userId)
    .single()

  if (fetchError) {
    console.error('[User Sync] Error fetching user for streak:', fetchError)
    return // Non-fatal
  }

  const today = new Date().toISOString().split('T')[0]
  const lastLoginDate = user.last_login_date

  let updates: any = {
    last_login_date: today,
    last_login: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  if (!lastLoginDate) {
    // First login
    updates.consecutive_login_days = 1
    updates.total_unique_days = 1
  } else if (lastLoginDate === today) {
    // Already logged in today - no streak change
    console.log('[User Sync] User already logged in today')
    return
  } else {
    const lastDate = new Date(lastLoginDate)
    const currentDate = new Date(today)
    const dayDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (dayDiff === 1) {
      // Consecutive day
      updates.consecutive_login_days = user.consecutive_login_days + 1
      updates.total_unique_days = user.total_unique_days + 1
    } else {
      // Streak broken
      updates.consecutive_login_days = 1
      updates.total_unique_days = user.total_unique_days + 1
    }
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)

  if (updateError) {
    console.error('[User Sync] Error updating streak:', updateError)
    // Non-fatal - continue
  } else {
    console.log('[User Sync] Login streak updated:', updates)
  }
}

/**
 * Save completed pomodoro atomically
 * Uses atomic database function to prevent inconsistent state
 */
export async function saveCompletedPomodoro(
  userId: string,
  discordId: string,
  data: {
    duration_minutes: number
    xp_earned: number
    task_name?: string
    notes?: string
  }
): Promise<string> {
  console.log(`[User Sync] Saving pomodoro for user ${userId}`)

  // Use atomic RPC function to save pomodoro and update stats in one transaction
  const { data: pomodoroId, error } = await supabase.rpc(
    'atomic_save_completed_pomodoro',
    {
      p_user_id: userId,
      p_discord_id: discordId,
      p_duration_minutes: data.duration_minutes,
      p_xp_earned: data.xp_earned,
      p_task_name: data.task_name || null,
      p_notes: data.notes || null
    }
  )

  if (error) {
    console.error('[User Sync] Error saving pomodoro:', error)
    throw new Error(`Failed to save pomodoro: ${error.message}`)
  }

  console.log('[User Sync] Pomodoro saved successfully:', pomodoroId)
  return pomodoroId as string
}

/**
 * Get user's recent pomodoros
 */
export async function getRecentPomodoros(
  userId: string,
  limit: number = 10
): Promise<any[]> {
  const { data, error } = await supabase
    .from('completed_pomodoros')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[User Sync] Error fetching pomodoros:', error)
    throw new Error('Failed to fetch pomodoro history')
  }

  return data || []
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string): Promise<{
  totalPomodoros: number
  totalMinutes: number
  averagePerDay: number
  currentStreak: number
}> {
  const { data: user, error } = await supabase
    .from('users')
    .select('total_pomodoros, total_study_minutes, consecutive_login_days, total_unique_days')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[User Sync] Error fetching stats:', error)
    throw new Error('Failed to fetch statistics')
  }

  // Calculate average based on total unique days (not consecutive days)
  const averagePerDay = user.total_pomodoros > 0
    ? Math.round(user.total_pomodoros / Math.max(1, user.total_unique_days))
    : 0

  return {
    totalPomodoros: user.total_pomodoros,
    totalMinutes: user.total_study_minutes,
    averagePerDay,
    currentStreak: user.consecutive_login_days
  }
}

/**
 * Unlock a milestone reward for the user
 */
export async function unlockMilestoneReward(
  userId: string,
  rewardType: 'background' | 'theme' | 'badge' | 'playlist',
  unlockId: string,
  milestoneId?: string
): Promise<string> {
  console.log(`[User Sync] Unlocking reward for user ${userId}: ${rewardType}/${unlockId}`)

  const { data: rewardId, error } = await supabase.rpc('unlock_milestone_reward', {
    p_user_id: userId,
    p_reward_type: rewardType,
    p_unlock_id: unlockId,
    p_milestone_id: milestoneId || null
  })

  if (error) {
    console.error('[User Sync] Error unlocking reward:', error)
    throw new Error(`Failed to unlock reward: ${error.message}`)
  }

  console.log('[User Sync] Reward unlocked successfully:', rewardId)
  return rewardId as string
}

/**
 * Get all unlocked rewards for a user
 */
export async function getUserUnlockedRewards(
  userId: string,
  rewardType?: 'background' | 'theme' | 'badge' | 'playlist'
): Promise<Array<{
  id: string
  reward_type: string
  unlock_id: string
  milestone_id: string | null
  unlocked_at: string
}>> {
  console.log(`[User Sync] Fetching unlocked rewards for user ${userId}`)

  const { data, error } = await supabase.rpc('get_user_unlocked_rewards', {
    p_user_id: userId,
    p_reward_type: rewardType || null
  })

  if (error) {
    console.error('[User Sync] Error fetching rewards:', error)
    throw new Error(`Failed to fetch unlocked rewards: ${error.message}`)
  }

  return data || []
}

/**
 * Check if a specific reward is unlocked for the user
 */
export async function isRewardUnlocked(
  userId: string,
  rewardType: 'background' | 'theme' | 'badge' | 'playlist',
  unlockId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_unlocked_rewards')
    .select('id')
    .eq('user_id', userId)
    .eq('reward_type', rewardType)
    .eq('unlock_id', unlockId)
    .maybeSingle()

  if (error) {
    console.error('[User Sync] Error checking reward:', error)
    return false
  }

  return data !== null
}

/**
 * Update username with cooldown enforcement
 */
export async function updateUsername(
  userId: string,
  newUsername: string,
  cooldownHours: number = 720 // 30 days default
): Promise<{
  success: boolean
  message: string
  user?: AppUser
}> {
  console.log(`[User Sync] Updating username for user ${userId} to: ${newUsername}`)

  const { data, error } = await supabase.rpc('update_username_with_cooldown', {
    p_user_id: userId,
    p_new_username: newUsername,
    p_cooldown_hours: cooldownHours
  })

  if (error) {
    console.error('[User Sync] Error updating username:', error)
    throw new Error(`Failed to update username: ${error.message}`)
  }

  // RPC returns a table, get first row
  const result = Array.isArray(data) ? data[0] : data

  return {
    success: result.success,
    message: result.message,
    user: result.user_data as AppUser
  }
}
