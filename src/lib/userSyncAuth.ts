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
 * Update user settings (CLIENT-CONTROLLED)
 *
 * SECURITY: Only syncs settings that users can safely control.
 * Does NOT sync XP, levels, or stats (those are server-controlled).
 *
 * Stats are updated ONLY through server-validated endpoints:
 * - atomic_save_completed_pomodoro() - When user completes a pomodoro
 * - increment_user_xp() - Server-controlled XP updates
 * - increment_pomodoro_totals() - Server-controlled stat updates
 *
 * This prevents users from cheating by setting arbitrary XP/levels.
 *
 * Supports dual authentication modes:
 * - Web Mode: Uses Supabase Auth session (auth.uid()) via update_user_settings RPC
 * - Discord Activity Mode: Uses Discord SDK identity (discord_id) via update_user_settings_discord RPC
 */
export async function updateUserPreferences(
  userId: string,
  discordId: string,
  preferences: {
    // Timer preferences (6 fields) - SAFE to sync from client
    timer_pomodoro_minutes?: number
    timer_short_break_minutes?: number
    timer_long_break_minutes?: number
    pomodoros_before_long_break?: number
    auto_start_breaks?: boolean
    auto_start_pomodoros?: boolean

    // Visual preferences (3 fields) - SAFE to sync from client
    background_id?: string
    playlist?: 'lofi' | 'synthwave'
    ambient_volumes?: Record<string, number>

    // Audio preferences (3 fields) - SAFE to sync from client
    sound_enabled?: boolean
    volume?: number
    music_volume?: number

    // System preferences (2 fields) - SAFE to sync from client
    level_system_enabled?: boolean
    level_path?: 'elf' | 'human'  // Visual preference only
  }
): Promise<AppUser> {
  console.log(`[User Sync] Updating user settings for user ${userId}`)

  // Determine authentication mode by checking for Supabase session
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Web Mode: Use Supabase Auth with auth.uid()
    console.log('[User Sync] Using web mode (Supabase Auth)')

    const { data, error } = await supabase.rpc('update_user_settings', {
      p_user_id: userId,

      // Timer preferences
      p_timer_pomodoro_minutes: preferences.timer_pomodoro_minutes ?? null,
      p_timer_short_break_minutes: preferences.timer_short_break_minutes ?? null,
      p_timer_long_break_minutes: preferences.timer_long_break_minutes ?? null,
      p_pomodoros_before_long_break: preferences.pomodoros_before_long_break ?? null,
      p_auto_start_breaks: preferences.auto_start_breaks ?? null,
      p_auto_start_pomodoros: preferences.auto_start_pomodoros ?? null,

      // Visual preferences
      p_background_id: preferences.background_id ?? null,
      p_playlist: preferences.playlist ?? null,
      p_ambient_volumes: preferences.ambient_volumes ?? null,

      // Audio preferences
      p_sound_enabled: preferences.sound_enabled ?? null,
      p_volume: preferences.volume ?? null,
      p_music_volume: preferences.music_volume ?? null,

      // System preferences
      p_level_system_enabled: preferences.level_system_enabled ?? null,
      p_level_path: preferences.level_path ?? null
    })

    if (error) {
      console.error('[User Sync] Error updating settings:', error)
      throw new Error(`Failed to update settings: ${error.message}`)
    }

    console.log('[User Sync] Settings updated successfully (web mode)')
    return data as AppUser
  } else {
    // Discord Activity Mode: Use Discord ID from Discord SDK
    console.log('[User Sync] Using Discord Activity mode (Discord SDK)')

    const { data, error } = await supabase.rpc('update_user_settings_discord', {
      p_discord_id: discordId,

      // Timer preferences
      p_timer_pomodoro_minutes: preferences.timer_pomodoro_minutes ?? null,
      p_timer_short_break_minutes: preferences.timer_short_break_minutes ?? null,
      p_timer_long_break_minutes: preferences.timer_long_break_minutes ?? null,
      p_pomodoros_before_long_break: preferences.pomodoros_before_long_break ?? null,
      p_auto_start_breaks: preferences.auto_start_breaks ?? null,
      p_auto_start_pomodoros: preferences.auto_start_pomodoros ?? null,

      // Visual preferences
      p_background_id: preferences.background_id ?? null,
      p_playlist: preferences.playlist ?? null,
      p_ambient_volumes: preferences.ambient_volumes ?? null,

      // Audio preferences
      p_sound_enabled: preferences.sound_enabled ?? null,
      p_volume: preferences.volume ?? null,
      p_music_volume: preferences.music_volume ?? null,

      // System preferences
      p_level_system_enabled: preferences.level_system_enabled ?? null,
      p_level_path: preferences.level_path ?? null
    })

    if (error) {
      console.error('[User Sync] Error updating settings:', error)
      throw new Error(`Failed to update settings: ${error.message}`)
    }

    console.log('[User Sync] Settings updated successfully (Discord Activity mode)')
    return data as AppUser
  }
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
 * Get user by auth user ID
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  if (!username || username.trim().length === 0) return false;

  const { data, error } = await supabase.rpc('check_username_availability', {
    p_username: username
  });

  if (error) {
    console.error('[User Sync] Error checking username availability:', error);
    // Fail open (allow try) but log error
    return true;
  }

  return data as boolean;
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
    critical_success?: boolean
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
      p_critical_success: data.critical_success || false,
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
 * Update username with cooldown enforcement and optional XP cost
 *
 * SECURITY: Uses server-side validation to:
 * - Enforce 7-day cooldown between username changes
 * - Allow early change for 50 XP (atomically deducted)
 * - Validate username length and content
 * - Prevent bypassing XP cost via direct database updates
 *
 * Supports dual authentication modes:
 * - Web Mode: Uses Supabase Auth session (auth.uid()) via update_username RPC
 * - Discord Activity Mode: Uses Discord SDK identity (discord_id) via update_username_discord RPC
 *
 * @param userId - User's UUID
 * @param discordId - User's Discord ID (from AuthContext.appUser.discord_id)
 * @param newUsername - New username (max 20 characters)
 * @param forceWithXP - If true, spend 50 XP to bypass cooldown
 * @returns Updated user object
 */
export async function updateUsernameSecure(
  userId: string,
  discordId: string,
  newUsername: string,
  forceWithXP: boolean = false
): Promise<AppUser> {
  console.log(`[User Sync] Updating username for user ${userId} to: ${newUsername} (forceWithXP: ${forceWithXP})`)

  // Determine authentication mode by checking for Supabase session
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Web Mode: Use Supabase Auth with auth.uid()
    console.log('[User Sync] Using web mode (Supabase Auth)')

    const { data, error } = await supabase.rpc('update_username', {
      p_user_id: userId,
      p_new_username: newUsername,
      p_force_with_xp: forceWithXP
    })

    if (error) {
      console.error('[User Sync] Error updating username:', error)
      throw new Error(`Failed to update username: ${error.message}`)
    }

    console.log('[User Sync] Username updated successfully (web mode)')
    return data as AppUser
  } else {
    // Discord Activity Mode: Use Discord ID from Discord SDK
    console.log('[User Sync] Using Discord Activity mode (Discord SDK)')

    const { data, error } = await supabase.rpc('update_username_discord', {
      p_discord_id: discordId,
      p_new_username: newUsername,
      p_force_with_xp: forceWithXP
    })

    if (error) {
      console.error('[User Sync] Error updating username:', error)
      throw new Error(`Failed to update username: ${error.message}`)
    }

    console.log('[User Sync] Username updated successfully (Discord Activity mode)')
    return data as AppUser
  }
}

/**
 * Update username with cooldown enforcement (LEGACY)
 * @deprecated Use updateUsernameSecure instead
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

/**
 * Claim daily gift with server-side validation
 *
 * SECURITY: Uses server-side validation to:
 * - Prevent claiming multiple times per day
 * - Atomically award XP and update last claim date
 * - Optionally activate pomodoro boost
 * - Sync claim status across all devices
 *
 * @param userId - User's UUID
 * @param xpAmount - XP to award for this gift
 * @param activateBoost - If true, activate +25% XP boost for 24 hours
 * @returns Result with success status and new XP value
 */
export async function claimDailyGift(
  userId: string,
  discordId: string,
  xpAmount: number,
  activateBoost: boolean = false,
  boostDurationHours: number = 24,
  boostMultiplier: number = 1.25
): Promise<{
  success: boolean
  message: string
  xpAwarded?: number
  newXp?: number
  boostActivated?: boolean
  boostExpiresAt?: number
  boostMultiplier?: number
  alreadyClaimed?: boolean
}> {
  console.log(`[User Sync] Claiming daily gift for user ${userId} (XP: ${xpAmount}, Boost: ${activateBoost}, Multiplier: ${boostMultiplier})`)

  // Determine authentication mode by checking for Supabase session
  const { data: { session } } = await supabase.auth.getSession()

  let data, error

  if (session) {
    // Web Mode: Use Supabase Auth with auth.uid()
    console.log('[User Sync] Using web mode (Supabase Auth)')

    const result = await supabase.rpc('claim_daily_gift', {
      p_user_id: userId,
      p_xp_amount: xpAmount,
      p_activate_boost: activateBoost,
      p_boost_duration_hours: boostDurationHours,
      p_boost_multiplier: boostMultiplier
    })

    data = result.data
    error = result.error
  } else {
    // Discord Activity Mode: Use discord_id
    console.log('[User Sync] Using Discord Activity mode (discord_id)')

    const result = await supabase.rpc('claim_daily_gift_discord', {
      p_user_id: userId,
      p_discord_id: discordId,
      p_xp_amount: xpAmount,
      p_activate_boost: activateBoost,
      p_boost_duration_hours: boostDurationHours,
      p_boost_multiplier: boostMultiplier
    })

    data = result.data
    error = result.error
  }

  if (error) {
    console.error('[User Sync] Error claiming daily gift:', error)
    throw new Error(`Failed to claim daily gift: ${error.message}`)
  }

  const result = data as any

  if (!result.success) {
    console.log('[User Sync] Daily gift already claimed today')
  } else {
    console.log(`[User Sync] Daily gift claimed successfully - ${result.xp_awarded} XP awarded`)
    if (result.boost_activated) {
      console.log(`[User Sync] Boost activated: ${result.boost_multiplier}x until ${new Date(result.boost_expires_at)}`)
    }
  }

  // Convert boost_expires_at to milliseconds timestamp
  let boostExpiresAtMs: number | undefined = undefined;
  if (result.boost_expires_at) {
    if (typeof result.boost_expires_at === 'string') {
      // ISO timestamp string - convert to milliseconds
      boostExpiresAtMs = new Date(result.boost_expires_at).getTime();
    } else if (typeof result.boost_expires_at === 'number') {
      // Check if seconds or milliseconds
      // If > 100000000000 (Nov 1973 in milliseconds), it's already in milliseconds
      // Otherwise it's in seconds and needs conversion
      boostExpiresAtMs = result.boost_expires_at > 100000000000
        ? result.boost_expires_at
        : result.boost_expires_at * 1000;
    }
  }

  console.log('[User Sync] Boost expires at:', {
    raw: result.boost_expires_at,
    converted: boostExpiresAtMs,
    activated: result.boost_activated
  });

  return {
    success: result.success,
    message: result.message,
    xpAwarded: result.xp_awarded,
    newXp: result.new_xp,
    boostActivated: result.boost_activated || false,
    boostExpiresAt: boostExpiresAtMs,
    boostMultiplier: result.boost_multiplier,
    alreadyClaimed: result.already_claimed || false
  }
}

/**
 * Check if user can claim daily gift today
 *
 * @param userId - User's UUID
 * @param discordId - User's Discord ID (for Discord Activity mode)
 * @returns true if gift can be claimed, false if already claimed today
 */
export async function canClaimDailyGift(userId: string, _discordId: string): Promise<boolean> {
  console.log(`[User Sync] Checking if user ${userId} can claim daily gift`)

  // Determine authentication mode by checking for Supabase session
  const { data: { session } } = await supabase.auth.getSession()

  let data, error

  if (session) {
    // Web Mode: Use Supabase Auth with auth.uid()
    const result = await supabase.rpc('can_claim_daily_gift', {
      p_user_id: userId
    })

    data = result.data
    error = result.error
  } else {
    // Discord Activity Mode: Use same RPC as web mode (no separate function)
    const result = await supabase.rpc('can_claim_daily_gift', {
      p_user_id: userId,
    })

    data = result.data
    error = result.error
  }

  if (error) {
    console.error('[User Sync] Error checking gift eligibility:', error)
    return false // Fail safe - don't allow claim if we can't verify
  }

  return data as boolean
}

/**
 * Reset user progress (XP, level, prestige, stats)
 * Supports dual authentication modes (web + Discord Activity)
 */
export async function resetUserProgress(
  userId: string,
  discordId: string
): Promise<AppUser> {
  console.log(`[User Sync] Resetting progress for user ${userId}`)

  // Determine authentication mode
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Web Mode: Use Supabase Auth
    console.log('[User Sync] Using web mode for reset')

    const { data, error } = await supabase.rpc('reset_user_progress', {
      p_user_id: userId
    })

    if (error) {
      console.error('[User Sync] Error resetting progress:', error)
      throw new Error(`Failed to reset progress: ${error.message}`)
    }

    if (!data) {
      console.error('[User Sync] No data returned from reset_user_progress')
      throw new Error('Failed to reset progress: No data returned')
    }

    console.log('[User Sync] Progress reset successfully (web mode)')
    return data as AppUser
  } else {
    // Discord Activity Mode
    console.log('[User Sync] Using Discord Activity mode for reset')

    const { data, error } = await supabase.rpc('reset_user_progress_discord', {
      p_discord_id: discordId
    })

    if (error) {
      console.error('[User Sync] Error resetting progress:', error)
      throw new Error(`Failed to reset progress: ${error.message}`)
    }

    if (!data) {
      console.error('[User Sync] No data returned from reset_user_progress_discord')
      throw new Error('Failed to reset progress: No data returned')
    }

    console.log('[User Sync] Progress reset successfully (Discord Activity mode)')
    return data as AppUser
  }
}

/**
 * Save completed break atomically with dual authentication support
 * Uses atomic database function to prevent inconsistent state
 *
 * Supports dual authentication modes:
 * - Web Mode: Uses Supabase Auth session (auth.uid()) via atomic_save_completed_break RPC
 * - Discord Activity Mode: Uses Discord SDK identity (discord_id) via atomic_save_completed_break_discord RPC
 */
export async function saveCompletedBreak(
  userId: string,
  discordId: string,
  data: {
    break_type: 'short' | 'long'
    duration_minutes: number
    xp_earned: number
  }
): Promise<string> {
  console.log(`[User Sync] Saving break for user ${userId}`)

  // Determine authentication mode by checking for Supabase session
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Web Mode: Use Supabase Auth with auth.uid()
    console.log('[User Sync] Using web mode (Supabase Auth)')

    const { data: breakId, error } = await supabase.rpc(
      'atomic_save_completed_break',
      {
        p_user_id: userId,
        p_discord_id: discordId,
        p_break_type: data.break_type,
        p_duration_minutes: data.duration_minutes,
        p_xp_earned: data.xp_earned
      }
    )

    if (error) {
      console.error('[User Sync] Error saving break:', error)
      throw new Error(`Failed to save break: ${error.message}`)
    }

    console.log('[User Sync] Break saved successfully (web mode):', breakId)
    return breakId as string
  } else {
    // Discord Activity Mode: Use Discord ID from Discord SDK
    console.log('[User Sync] Using Discord Activity mode (Discord SDK)')

    const { data: breakId, error } = await supabase.rpc(
      'atomic_save_completed_break_discord',
      {
        p_user_id: userId,
        p_discord_id: discordId,
        p_break_type: data.break_type,
        p_duration_minutes: data.duration_minutes,
        p_xp_earned: data.xp_earned
      }
    )

    if (error) {
      console.error('[User Sync] Error saving break:', error)
      throw new Error(`Failed to save break: ${error.message}`)
    }

    console.log('[User Sync] Break saved successfully (Discord Activity mode):', breakId)
    return breakId as string
  }
}

/**
 * Claim daily gift XP with server-side validation
 * Prevents XP exploit from repeated page reloads
 *
 * SECURITY: Server validates:
 * - User hasn't already claimed today (checks last_login_date in DB)
 * - Atomically updates XP + login date + streak
 *
 * Supports dual authentication modes (web + Discord Activity)
 */
export async function claimDailyGiftXP(
  userId: string,
  discordId: string
): Promise<{ success: boolean; xpAwarded: number; consecutiveDays: number }> {
  console.log(`[User Sync] Claiming daily gift XP for user ${userId}`)

  // Determine authentication mode
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Web Mode: Use Supabase Auth
    console.log('[User Sync] Using web mode for daily gift claim')

    const { data, error } = await supabase.rpc('claim_daily_gift_xp', {
      p_user_id: userId
    })

    if (error) {
      console.error('[User Sync] Error claiming daily gift:', error)
      throw new Error(`Failed to claim daily gift: ${error.message}`)
    }

    const result = Array.isArray(data) ? data[0] : data
    console.log('[User Sync] Daily gift claim result (web mode):', result)
    return {
      success: result.success,
      xpAwarded: result.xp_awarded,
      consecutiveDays: result.consecutive_days
    }
  } else {
    // Discord Activity Mode
    console.log('[User Sync] Using Discord Activity mode for daily gift claim')

    const { data, error } = await supabase.rpc('claim_daily_gift_xp_discord', {
      p_discord_id: discordId
    })

    if (error) {
      console.error('[User Sync] Error claiming daily gift:', error)
      throw new Error(`Failed to claim daily gift: ${error.message}`)
    }

    const result = Array.isArray(data) ? data[0] : data
    console.log('[User Sync] Daily gift claim result (Discord Activity mode):', result)
    return {
      success: result.success,
      xpAwarded: result.xp_awarded,
      consecutiveDays: result.consecutive_days
    }
  }
}
