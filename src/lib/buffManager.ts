/**
 * Buff Management System
 *
 * Handles active buff tracking, stacking, and XP calculations.
 * Buffs are stored in database as JSONB and synced to local state.
 */

import { supabase } from './supabase';
import { getEventBuff, eventBuffAppliesToRole, type RoleBuff, type RoleType } from '../data/roleSystem';

export interface ActiveBuff {
  value: number; // XP multiplier (0.15 = +15%)
  expiresAt: number | null; // Milliseconds timestamp, null = permanent
  metadata?: Record<string, any>;
}

export interface BuffStackResult {
  totalXPMultiplier: number; // Final additive multiplier (1.40 = +40% total)
  activeBuffs: RoleBuff[]; // List of active buff configs
  bonusStrings: string[]; // Human-readable bonus descriptions
}

/**
 * Get user's active buffs from database (JSONB column)
 */
export async function getUserActiveBuffs(userId: string): Promise<Record<string, ActiveBuff>> {
  const { data, error } = await supabase
    .from('users')
    .select('active_buffs')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[BuffManager] Error fetching active buffs:', error);
    return {};
  }

  return (data?.active_buffs as Record<string, ActiveBuff>) || {};
}

/**
 * Add or update a buff for a user
 */
export async function setUserBuff(
  userId: string,
  buffId: string,
  value: number,
  expiresAt: number | null = null,
  metadata: Record<string, any> = {}
): Promise<void> {
  const { error } = await supabase.rpc('set_user_buff', {
    p_user_id: userId,
    p_buff_id: buffId,
    p_value: value,
    p_expires_at: expiresAt,
    p_metadata: metadata
  });

  if (error) {
    console.error('[BuffManager] Error setting buff:', error);
    throw new Error(`Failed to set buff: ${error.message}`);
  }

  console.log(`[BuffManager] ✓ Set buff ${buffId} for user (value: ${value}, expires: ${expiresAt ? new Date(expiresAt) : 'never'})`);
}

/**
 * Remove a buff from a user
 */
export async function removeUserBuff(userId: string, buffId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_user_buff', {
    p_user_id: userId,
    p_buff_id: buffId
  });

  if (error) {
    console.error('[BuffManager] Error removing buff:', error);
    throw new Error(`Failed to remove buff: ${error.message}`);
  }

  console.log(`[BuffManager] ✓ Removed buff ${buffId} for user`);
}

/**
 * Clear expired buffs for a user
 */
export async function clearExpiredBuffs(userId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_expired_buffs', {
    p_user_id: userId
  });

  if (error) {
    console.error('[BuffManager] Error clearing expired buffs:', error);
    return;
  }

  console.log('[BuffManager] ✓ Cleared expired buffs');
}

/**
 * Calculate stacked buff multiplier (ADDITIVE)
 *
 * Combines all active event buffs that apply to the user's role.
 * Example: +25% day10_boost + +25% slingshot = +50% total
 *
 * Does NOT include:
 * - Permanent role buffs (handled separately in calculateRoleXP)
 * - Proc buffs like human crits (applied after as final multiplier)
 */
export function calculateBuffStack(
  activeBuffs: Record<string, ActiveBuff>,
  roleType: RoleType
): BuffStackResult {
  const now = Date.now();
  const result: BuffStackResult = {
    totalXPMultiplier: 1.0, // Start at 1.0 (no bonus)
    activeBuffs: [],
    bonusStrings: []
  };

  // Process each active buff
  for (const [buffId, buffData] of Object.entries(activeBuffs)) {
    // Check if expired (skip time-limited buffs that expired)
    if (buffData.expiresAt && buffData.expiresAt <= now) {
      console.log(`[BuffManager] Skipping expired buff: ${buffId}`);
      continue;
    }

    /**
     * Event buff date validation: Keep in storage but don't apply if event ended
     * Allows future reactivation without re-granting the buff
     */
    if (buffId === 'slingshot_nov22') {
      // UTC-based date check
      const now = Date.now();
      const startDate = Date.UTC(2025, 10, 22); // Nov 22 00:00 UTC (month is 0-indexed)
      const endDate = Date.UTC(2025, 10, 24);   // Nov 24 00:00 UTC (end of Nov 23)
      const isEventActive = now >= startDate && now < endDate;

      if (!isEventActive) {
        console.log('[BuffManager] Slingshot event not active, keeping in storage');
        continue; // Skip XP bonus but preserve in DB
      }
    }

    // Get buff configuration
    const buffConfig = getEventBuff(buffId);
    if (!buffConfig) {
      console.warn(`[BuffManager] Unknown buff ID: ${buffId}`);
      continue;
    }

    // Check if buff applies to this role
    if (!eventBuffAppliesToRole(buffConfig, roleType)) {
      console.log(`[BuffManager] Buff ${buffId} doesn't apply to ${roleType}`);
      continue;
    }

    // Add buff to active list
    result.activeBuffs.push(buffConfig);

    // Add XP multiplier (ADDITIVE)
    const buffMultiplier = buffData.value;
    result.totalXPMultiplier += buffMultiplier;

    // Create human-readable string
    const percentage = Math.round(buffMultiplier * 100);
    result.bonusStrings.push(`+${percentage}% ${buffConfig.name}`);

    console.log(`[BuffManager] Applied buff ${buffId}: +${percentage}%`);
  }

  return result;
}

/**
 * Activate slingshot buff (Nov 22-23, elf only, +25% XP)
 */
export async function activateSlingshotBuff(userId: string): Promise<void> {
  // UTC-based date check
  const now = Date.now();
  const startDate = Date.UTC(2025, 10, 22); // Nov 22 00:00 UTC (month is 0-indexed)

  if (now < startDate) {
    console.log('[BuffManager] Slingshot buff not yet active (activates Nov 22 UTC)');
    return;
  }

  // Set permanent slingshot buff (no expiration)
  await setUserBuff(
    userId,
    'slingshot_nov22',
    0.25, // +25%
    null, // No expiration
    { activatedAt: Date.now() }
  );

  console.log('[BuffManager] ✓ Activated slingshot buff (+25% XP)');
}

/**
 * Activate day 10 gift boost (24 hours)
 */
export async function activateDay10Boost(userId: string): Promise<void> {
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

  await setUserBuff(
    userId,
    'day10_boost',
    0.25, // +25%
    expiresAt,
    { claimedAt: Date.now() }
  );

  console.log('[BuffManager] ✓ Activated day 10 boost (expires in 24h)');
}

/**
 * Check if user should have slingshot buff activated automatically
 * Uses UTC to ensure consistent activation across all timezones
 */
export function shouldAutoActivateSlingshot(roleType: RoleType): boolean {
  if (roleType !== 'elf') return false;

  const now = Date.now();
  const activationDate = Date.UTC(2025, 10, 22); // Nov 22 00:00 UTC (month is 0-indexed)

  return now >= activationDate;
}
