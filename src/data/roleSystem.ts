/**
* Role System Configuration
* Defines unique stats, buffs, and events for each role (Elf/Human)
*/

export type RoleType = 'elf' | 'human';
export type BuffCategory = 'permanent' | 'event' | 'proc';

export interface RoleBuff {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'passive' | 'active' | 'proc'; // passive = always on, active = user triggered, proc = chance-based
  category: BuffCategory; // permanent = always active, event = time-limited, proc = chance-based
  roles?: RoleType[]; // Which roles can use this buff (undefined = all roles)
  xpBonus?: number; // XP multiplier (0.15 = +15%)
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
      category: 'permanent',
      xpBonus: 0.5,
    },
  ],
  stats: {
    baseXPMultiplier: 1.0,
    xpBonus: 0.5, // +0.5 XP/min
    levelUpReward: 5, // +5 XP bonus on level up
  },
  events: [
    {
      id: 'elf_perfect_day',
      name: 'Perfect Day',
      description: 'Completing 8+ pomodoros in one day grants +50 bonus XP',
      trigger: 'daily_login',
      effect: () => {
        // Check if completed 8+ pomodoros today
        // This would be tracked in state
        import.meta.env.DEV && console.log('[Elf Event] Checking for Perfect Day bonus');
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
      category: 'proc',
    }
  ],
  stats: {
    baseXPMultiplier: 1.0,
    xpBonus: 0, // No flat bonus
    criticalChance: 0.25, // 25% base crit chance
    criticalMultiplier: 2.0, // 2x XP on crit
  },
  events: [
    {
      id: 'human_lucky_streak',
      name: 'Lucky Streak',
      description: '3 crits in a row grants +100 bonus XP',
      trigger: 'pomodoro_complete',
      effect: () => {
        import.meta.env.DEV && console.log('[Human Event] Checking for Lucky Streak');
        // Track consecutive crits
      },
    },
    {
      id: 'human_underdog',
      name: 'Underdog Bonus',
      description: 'Being 2+ levels below average player level grants +25% XP',
      trigger: 'pomodoro_complete',
      effect: () => {
        import.meta.env.DEV && console.log('[Human Event] Checking Underdog status');
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

export interface RoleXPOptions {
  consecutiveDays?: number;
  prestigeLevel?: number;
  consecutiveCrits?: number;
}

export function calculateRoleXP(
  roleType: RoleType,
  baseMinutes: number,
  _options: RoleXPOptions = {}
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
  }

  if (roleType === 'human') {
    // Human: Critical chance
    let critChance = stats.criticalChance || 0;

    // Roll for critical
    if (Math.random() < critChance) {
      criticalSuccess = true;
      bonuses.push('🎯 CRITICAL SUCCESS!');
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

// ============================================
// EVENT BUFFS (TIME-LIMITED, ALL OR SPECIFIC ROLES)
// ============================================

export const EVENT_BUFFS: RoleBuff[] = [
  {
    id: 'day10_boost',
    name: '+25% XP Boost',
    description: '24-hour XP boost from day 10 gift',
    icon: '🍅',
    type: 'passive',
    category: 'event',
    xpBonus: 0.25, // +25%
    // No roles restriction - applies to all
  },
  {
    id: 'slingshot_nov22',
    name: 'Elven Slingshot',
    description: '+25% XP boost (Nov 22-23 event)',
    icon: '🏹',
    type: 'passive',
    category: 'event',
    roles: ['elf'], // Only elves
    xpBonus: 0.25, // +25%
  },
];

/**
 * Get event buff by ID
 */
export function getEventBuff(buffId: string): RoleBuff | undefined {
  return EVENT_BUFFS.find(b => b.id === buffId);
}

/**
 * Check if an event buff applies to a role
 */
export function eventBuffAppliesToRole(buff: RoleBuff, roleType: RoleType): boolean {
  // If no role restriction, applies to all
  if (!buff.roles || buff.roles.length === 0) return true;
  // Check if role is in the allowed list
  return buff.roles.includes(roleType);
}

/**
 * Get active buffs for a role
 * Currently returns all passive and proc-type buffs
 * (Future: could add conditional logic based on game state)
 */
export function getActiveBuffs(
  roleType: RoleType
): RoleBuff[] {
  const allBuffs = getRoleBuffs(roleType);

  // Return all passive and proc buffs (always active)
  return allBuffs.filter(buff => buff.type === 'passive' || buff.type === 'proc');
}
