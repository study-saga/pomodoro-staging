export interface Track {
  id: string;
  title: string;
  artist: string;
  file: string;
  genre: 'lofi' | 'synthwave';
  credits?: string;
}

export interface Settings {
  // Timer settings
  timers: {
    pomodoro: number;
    shortBreak: number;
    longBreak: number;
  };
  pomodorosBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;

  // Audio settings
  soundEnabled: boolean;
  volume: number;
  musicVolume: number;
  ambientVolumes: Record<string, number>;

  // Visual settings
  background: string;
  playlist: 'lofi' | 'synthwave';

  // Level system
  xp: number;
  level: number;
  prestigeLevel: number;
  totalPomodoros: number;
  totalStudyMinutes: number;
  username: string;
  lastUsernameChange: number | null;
  levelPath: 'elf' | 'human';
  levelSystemEnabled: boolean;

  // Milestone system
  totalUniqueDays: number;
  lastPomodoroDate: string | null; // ISO date string (YYYY-MM-DD)

  // Login tracking (for daily gifts)
  totalLoginDays: number; // Total unique days user visited
  consecutiveLoginDays: number; // Current login streak (max 12)
  lastLoginDate: string | null; // Last login date (YYYY-MM-DD)
  lastDailyGiftDate: string | null; // Last date daily gift was claimed (YYYY-MM-DD)
  firstLoginDate: string | null; // First login date (YYYY-MM-DD)

  // Active bonuses
  pomodoroBoostActive: boolean; // Whether ANY boost is active
  pomodoroBoostExpiresAt: number | null; // Timestamp when boost expires

  // Role-specific stats
  consecutiveCriticals: number; // Track consecutive crits for humans (negative = consecutive fails)
  todayPomodoros: number; // Pomodoros completed today (for elf perfect day event)
  comebackActive: boolean; // Human comeback buff active
  comebackPomodoros: number; // Remaining pomodoros with comeback buff
}

export interface LevelData {
  level: number;
  xp: number;
  xpNeeded: number;
  levelName: string;
  description: string;
  prestigeLevel: number;
  badge: string;
  roleEmoji: string;
}

export interface AmbientSound {
  id: string;
  name: string;
  file: string;
  volume: number;
}

export interface Background {
  id: string;
  name: string;
  file: string;
  poster: string;
  type: 'video';
  orientation: 'vertical' | 'horizontal';
}

export type TimerType = 'pomodoro' | 'shortBreak' | 'longBreak';

export interface TimerState {
  type: TimerType;
  isRunning: boolean;
  timeLeft: number;
  pomodoroCount: number;
}

export interface UnlockedReward {
  id: string;
  user_id: string;
  reward_type: 'background' | 'theme' | 'badge' | 'playlist';
  unlock_id: string;
  milestone_id: string | null;
  unlocked_at: string;
}
