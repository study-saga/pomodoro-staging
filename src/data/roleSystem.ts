/**
 * Role System Configuration
 * Defines unique stats, buffs, and events for each role (Elf/Human)
 */

export type RoleType = 'elf' | 'human';

export interface RoleBuff {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'passive' | 'active' | 'proc'; // passive = always on, active = user triggered, proc = chance-based
}

export interface RoleStats {
  // Core XP modifiers
  baseXPMultiplier: number; // Multiplies base XP per minute
  xpBonus: number; // Flat XP bonus per minute

  // Special mechanics
  criticalChance?: number; // Chance to trigger critical success (0-1)
  criticalMultiplier?: number; // XP multiplier on critical success

  // Streak bonuses
  streakBonus?: number; // Bonus XP per consecutive day
  maxStreakBonus?: number; // Cap on streak bonus

  // Study efficiency
  breakTimeReduction?: number; // Percentage reduction in break duration
  focusBonus?: number; // Bonus XP after long study sessions

  // Level progression
  prestigeXPBonus?: number; // Bonus XP per prestige level
  levelUpReward?: number; // Bonus XP on level up
}

export interface RoleEvent {
  id: string;
  name: string;
  description: string;
  trigger: 'pomodoro_complete' | 'level_up' | 'streak_milestone' | 'daily_login' | 'prestige';
  effect: (state: any) => void; // Function that applies the event effect
  chance?: number; // Probability of triggering (0-1), if random
  cooldown?: number; // Milliseconds before can trigger again
}

export interface RoleConfig {
  id: RoleType;
  name: string;
  emoji: string;
  description: string;
  theme: {
    primary: string;
    secondary: string;
    gradient: string;
  };
  buffs: RoleBuff[];
  stats: RoleStats;
  events: RoleEvent[];
}

// ============================================
// ELF ROLE CONFIGURATION
// ============================================
export const ELF_ROLE: RoleConfig = {
  id: 'elf',
  name: 'Elf',
  emoji: '🧝',
  description: 'Masters of consistency and focus. Steady growth through disciplined practice.',
  theme: {
    primary: '#a855f7', // Purple
    secondary: '#9333ea',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
  },
  buffs: [
    {
      id: 'elf_consistency',
      name: 'Elven Focus',
      description: '+0.5 XP per minute (consistent bonus)',
      icon: '🎯',
      type: 'passive',
    },
    {
      id: 'elf_streak_master',
      name: 'Streak Master',
      description: '+0.1 XP per consecutive day (max +2 XP/min)',
      icon: '📈',
      type: 'passive',
    },
    {
      id: 'elf_meditation',
      name: 'Meditation',
      description: 'Break time reduced by 20%',
      icon: '🧘',
      type: 'passive',
    },
  ],
  stats: {
    baseXPMultiplier: 1.0,
    xpBonus: 0.5, // +0.5 XP/min
    streakBonus: 0.1, // +0.1 XP per day streak
    maxStreakBonus: 2.0, // Max +2 XP/min from streak
    breakTimeReduction: 0.2, // 20% shorter breaks
    levelUpReward: 5, // +5 XP bonus on level up
  },
  events: [
    {
      id: 'elf_perfect_day',
      name: 'Perfect Day',
      description: 'Completing 8+ pomodoros in one day grants +50 bonus XP',
      trigger: 'daily_login',
      effect: (state) => {
        // Check if completed 8+ pomodoros today
        const today = new Date().toISOString().split('T')[0];
        // This would be tracked in state
        console.log('[Elf Event] Checking for Perfect Day bonus');
      },
    },
  ],
};

// ============================================
// HUMAN ROLE CONFIGURATION
// ============================================
export const HUMAN_ROLE: RoleConfig = {
  id: 'human',
  name: 'Human',
  emoji: '⚔️',
  description: 'High risk, high reward. Unpredictable but potentially explosive growth.',
  theme: {
    primary: '#3b82f6', // Blue
    secondary: '#2563eb',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  },
  buffs: [
    {
      id: 'human_critical',
      name: 'Critical Success',
      description: '25% chance to double session XP',
      icon: '🎯',
      type: 'proc',
    },
    {
      id: 'human_determination',
      name: 'Determination',
      description: 'Each failed crit increases next crit chance by 5% (stacks)',
      icon: '💪',
      type: 'passive',
    },
    {
      id: 'human_comeback',
      name: 'Comeback King',
      description: 'Breaking a streak of 7+ days grants 2x XP for next 3 pomodoros',
      icon: '👑',
      type: 'proc',
    },
  ],
  stats: {
    baseXPMultiplier: 1.0,
    xpBonus: 0, // No flat bonus
    criticalChance: 0.25, // 25% base crit chance
    criticalMultiplier: 2.0, // 2x XP on crit
    prestigeXPBonus: 0.1, // +10% XP per prestige level
  },
  events: [
    {
      id: 'human_lucky_streak',
      name: 'Lucky Streak',
      description: '3 crits in a row grants +100 bonus XP',
      trigger: 'pomodoro_complete',
      effect: (state) => {
        console.log('[Human Event] Checking for Lucky Streak');
        // Track consecutive crits
      },
    },
    {
      id: 'human_underdog',
      name: 'Underdog Bonus',
      description: 'Being 2+ levels below average player level grants +25% XP',
      trigger: 'pomodoro_complete',
      effect: (state) => {
        console.log('[Human Event] Checking Underdog status');
      },
    },
  ],
};

// ============================================
// ROLE SYSTEM UTILITIES
// ============================================

export const ROLES: Record<RoleType, RoleConfig> = {
  elf: ELF_ROLE,
  human: HUMAN_ROLE,
};

export function getRoleConfig(roleType: RoleType): RoleConfig {
  return ROLES[roleType];
}

export function getRoleBuffs(roleType: RoleType): RoleBuff[] {
  return ROLES[roleType].buffs;
}

export function getRoleStats(roleType: RoleType): RoleStats {
  return ROLES[roleType].stats;
}

export function calculateRoleXP(
  roleType: RoleType,
  baseMinutes: number,
  additionalContext?: {
    consecutiveDays?: number;
    prestigeLevel?: number;
    consecutiveCrits?: number;
  }
): { xpGained: number; criticalSuccess: boolean; bonuses: string[] } {
  const role = getRoleConfig(roleType);
  const stats = role.stats;
  const bonuses: string[] = [];

  let totalXP = 0;
  let criticalSuccess = false;

  // Base XP calculation
  const baseXPPerMinute = 2; // Default base
  let xpPerMinute = baseXPPerMinute * stats.baseXPMultiplier + stats.xpBonus;

  if (roleType === 'elf') {
    // Elf: Consistency bonus
    bonuses.push(`+${stats.xpBonus} XP/min (Elven Focus)`);

    // Streak bonus
    if (additionalContext?.consecutiveDays && stats.streakBonus) {
      const streakBonus = Math.min(
        additionalContext.consecutiveDays * stats.streakBonus,
        stats.maxStreakBonus || Infinity
      );
      xpPerMinute += streakBonus;
      bonuses.push(`+${streakBonus.toFixed(1)} XP/min (Streak Master)`);
    }
  }

  if (roleType === 'human') {
    // Human: Critical chance
    let critChance = stats.criticalChance || 0;

    // Determination buff: increase crit chance based on consecutive fails
    if (additionalContext?.consecutiveCrits !== undefined && additionalContext.consecutiveCrits < 0) {
      const failedAttempts = Math.abs(additionalContext.consecutiveCrits);
      const bonusCritChance = failedAttempts * 0.05;
      critChance = Math.min(critChance + bonusCritChance, 1.0);
      if (bonusCritChance > 0) {
        bonuses.push(`+${(bonusCritChance * 100).toFixed(0)}% crit chance (Determination)`);
      }
    }

    // Roll for critical
    if (Math.random() < critChance) {
      criticalSuccess = true;
      bonuses.push('🎯 CRITICAL SUCCESS!');
    }

    // Prestige bonus
    if (additionalContext?.prestigeLevel && stats.prestigeXPBonus) {
      const prestigeBonus = additionalContext.prestigeLevel * stats.prestigeXPBonus;
      xpPerMinute *= (1 + prestigeBonus);
      bonuses.push(`+${(prestigeBonus * 100).toFixed(0)}% XP (Prestige)`);
    }
  }

  // Calculate total XP
  totalXP = baseMinutes * xpPerMinute;

  // Apply critical multiplier
  if (criticalSuccess && stats.criticalMultiplier) {
    totalXP *= stats.criticalMultiplier;
  }

  return {
    xpGained: Math.floor(totalXP),
    criticalSuccess,
    bonuses,
  };
}

/**
 * Get active buffs for a role based on current state
 */
export function getActiveBuffs(
  roleType: RoleType,
  context: {
    consecutiveDays?: number;
    totalPomodoros?: number;
    level?: number;
  }
): RoleBuff[] {
  const allBuffs = getRoleBuffs(roleType);

  // For now, return all passive buffs
  // In the future, can add logic to enable/disable based on conditions
  return allBuffs.filter(buff => buff.type === 'passive' || buff.type === 'proc');
}
