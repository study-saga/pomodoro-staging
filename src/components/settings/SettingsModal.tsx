import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../../store/useSettingsStore';
import { BACKGROUNDS, AMBIENT_SOUNDS } from '../../data/constants';
import { useDeviceType } from '../../hooks/useDeviceType';
import {
  ROLE_EMOJI_ELF,
  ROLE_EMOJI_HUMAN,
  getLevelName,
  getBadgeForLevel,
} from '../../data/levels';
import { useAuth } from '../../contexts/AuthContext';
import { updateUsernameSecure, checkUsernameAvailability } from '../../lib/userSyncAuth';
// ... (imports remain unchanged)

// ... (inside component)

import { showGameToast } from '../ui/GameToast';
import { MusicCreditsModal } from './MusicCreditsModal';
import type { Track } from '../../types';
import lofiTracks from '../../data/lofi.json';
import synthwaveTracks from '../../data/synthwave.json';
import { createRateLimiter } from '../../utils/rateLimiters';

export function SettingsModal() {
  const { appUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'timer' | 'appearance' | 'sounds' | 'music' | 'progress'>('timer');
  const [roleChangeMessage, setRoleChangeMessage] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [showMusicCredits, setShowMusicCredits] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const rateLimiterRef = useRef(createRateLimiter(720000)); // 12 minutes (5 changes per hour)

  // Calculate total track count
  const totalTracks = lofiTracks.length + synthwaveTracks.length;

  // Listen for notification permission changes
  useEffect(() => {
    const handlePermissionChange = () => {
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    };
    window.addEventListener('notificationPermissionChange', handlePermissionChange);
    return () => window.removeEventListener('notificationPermissionChange', handlePermissionChange);
  }, []);

  // Auto-dismiss role change message
  useEffect(() => {
    if (roleChangeMessage) {
      const timer = setTimeout(() => {
        setRoleChangeMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [roleChangeMessage]);

  // Focus management: focus modal when opened, return focus when closed
  useEffect(() => {
    if (isOpen) {
      // Focus the modal container when it opens
      modalRef.current?.focus();
    } else {
      // Return focus to trigger button when modal closes
      triggerButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleRoleChange = (newRole: 'elf' | 'human') => {
    rateLimiterRef.current(() => {
      setLevelPath(newRole);

      const messages = {
        elf: [
          "You have chosen the path of the Elf! May nature guide your journey.",
          "The forest welcomes you, brave Elf. Your adventure begins anew!",
          "An Elf emerges! The ancient woods await your wisdom.",
          "You walk the Elven path. Grace and focus shall be your companions.",
        ],
        human: [
          "You have chosen the path of the Human! May courage light your way.",
          "A warrior's path chosen! Your legend starts now, brave Human.",
          "The Human spirit awakens within you. Face your challenges head-on!",
          "You walk the Human path. Strength and determination guide you forward.",
        ],
      };

      const randomMessage = messages[newRole][Math.floor(Math.random() * messages[newRole].length)];
      setRoleChangeMessage(randomMessage);
    })();
  };

  const {
    timers,
    setPomodoroDuration,
    setShortBreakDuration,
    setLongBreakDuration,
    pomodorosBeforeLongBreak,
    setPomodorosBeforeLongBreak,
    autoStartBreaks,
    setAutoStartBreaks,
    autoStartPomodoros,
    setAutoStartPomodoros,
    soundEnabled,
    setSoundEnabled,
    volume,
    setVolume,
    musicVolume,
    setMusicVolume,
    ambientVolumes,
    setAmbientVolume,
    background,
    setBackground,
    level,
    xp,
    prestigeLevel,
    totalPomodoros,
    totalStudyMinutes,
    resetProgress,
    username,
    setUsername,
    // canEditUsername, // Removed - using server-first approach instead
    levelSystemEnabled,
    setLevelSystemEnabled,
    levelPath,
    setLevelPath,
  } = useSettingsStore();

  const { isMobile, isPortrait } = useDeviceType();

  // Filter backgrounds based on viewport orientation (portrait vs landscape)
  const targetOrientation = isPortrait ? 'vertical' : 'horizontal';
  const filteredBackgrounds = BACKGROUNDS.filter(bg => bg.orientation === targetOrientation);

  // Cache level name to avoid redundant calculations (used twice for dynamic font sizing)
  const levelNameLabel = useMemo(() => getLevelName(level, levelPath), [level, levelPath]);

  // Temporary state for settings (only applied on Save)
  const [tempTimers, setTempTimers] = useState(timers);
  const [tempPomodorosBeforeLongBreak, setTempPomodorosBeforeLongBreak] = useState(pomodorosBeforeLongBreak);
  const [tempAutoStartBreaks, setTempAutoStartBreaks] = useState(autoStartBreaks);
  const [tempAutoStartPomodoros, setTempAutoStartPomodoros] = useState(autoStartPomodoros);
  const [tempSoundEnabled, setTempSoundEnabled] = useState(soundEnabled);
  const [tempVolume, setTempVolume] = useState(volume);
  const [tempMusicVolume, setTempMusicVolume] = useState(musicVolume);
  const [tempAmbientVolumes, setTempAmbientVolumes] = useState(ambientVolumes);
  const [tempBackground, setTempBackground] = useState(background);
  const [tempLevelSystemEnabled, setTempLevelSystemEnabled] = useState(levelSystemEnabled);
  const [usernameInput, setUsernameInput] = useState(username);

  // Reset temporary state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempTimers(timers);
      setTempPomodorosBeforeLongBreak(pomodorosBeforeLongBreak);
      setTempAutoStartBreaks(autoStartBreaks);
      setTempAutoStartPomodoros(autoStartPomodoros);
      setTempSoundEnabled(soundEnabled);
      setTempVolume(volume);
      setTempMusicVolume(musicVolume);
      setTempAmbientVolumes(ambientVolumes);
      setTempBackground(background);
      setTempLevelSystemEnabled(levelSystemEnabled);
      setUsernameInput(username);
    }
  }, [isOpen, timers, pomodorosBeforeLongBreak, autoStartBreaks, autoStartPomodoros, soundEnabled, volume, musicVolume, ambientVolumes, background, levelSystemEnabled, username]);

  const handleSaveUsername = async () => {
    if (!appUser) {
      setUsernameError('You must be logged in to change username');
      return;
    }

    if (!usernameInput || usernameInput.trim().length === 0) {
      setUsernameError('Username cannot be empty');
      return;
    }

    if (usernameInput.length > 20) {
      setUsernameError('Username cannot exceed 20 characters');
      return;
    }

    if (usernameInput === username) {
      setUsernameError('That is already your username');
      return;
    }

    setUsernameError(null);
    setUsernameLoading(true);

    try {
      // Check availability first (client-side check for better UX)
      const isAvailable = await checkUsernameAvailability(usernameInput);
      if (!isAvailable) {
        setUsernameError('Username is already taken');
        setUsernameLoading(false);
        return;
      }

      // Try free update first (let server decide if cooldown passed)
      const updatedUser = await updateUsernameSecure(appUser.id, appUser.discord_id, usernameInput, false);

      // Success - update local Zustand store with new username and timestamp
      setUsername(usernameInput);

      console.log('[Settings] Username updated successfully (free):', updatedUser.username);
      toast.success('Username updated successfully!');

    } catch (error) {
      console.error('[Settings] Error updating username:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if it's a cooldown error and user has enough XP
      if (errorMessage.includes('cooldown') && xp >= 50) {
        // Extract wait time from error message for better UX
        const waitTimeMatch = errorMessage.match(/Wait ([\d.]+) more hours/);
        const hours = waitTimeMatch ? waitTimeMatch[1] : 'several';

        // Show toast with action button to pay 50 XP
        toast('Username change is on cooldown', {
          description: `${hours} hours remaining. You can pay 50 XP to change now.`,
          duration: 10000,
          action: {
            label: 'Pay 50 XP',
            onClick: async () => {
              try {
                setUsernameLoading(true);
                // Retry with XP payment
                const updatedUser = await updateUsernameSecure(appUser.id, appUser.discord_id, usernameInput, true);

                // Success - update local Zustand store with new username, XP, and timestamp
                setUsername(usernameInput, true);

                console.log('[Settings] Username updated successfully (50 XP cost):', updatedUser.username, 'XP:', updatedUser.xp);
                toast.success('Username updated! 50 XP deducted.');
                showGameToast('-50 XP Spent');

              } catch (retryError) {
                console.error('[Settings] Error updating username with XP:', retryError);
                const retryMessage = retryError instanceof Error ? retryError.message : 'Unknown error';
                setUsernameError(retryMessage);
                toast.error(retryMessage);
              } finally {
                setUsernameLoading(false);
              }
            }
          },
          cancel: {
            label: 'Cancel',
            onClick: () => { }
          }
        });
      } else if (errorMessage.includes('cooldown')) {
        // Cooldown error but insufficient XP
        const waitTimeMatch = errorMessage.match(/Wait ([\d.]+) more hours/);
        const hours = waitTimeMatch ? waitTimeMatch[1] : 'several';
        setUsernameError(`Username change is on cooldown (${hours} hours remaining). You need 50 XP to change early.`);
      } else if (errorMessage.includes('Insufficient XP')) {
        setUsernameError('You do not have enough XP (need 50 XP)');
      } else if (errorMessage.includes('empty')) {
        setUsernameError('Username cannot be empty');
      } else if (errorMessage.includes('20 characters')) {
        setUsernameError('Username cannot exceed 20 characters');
      } else if (errorMessage.includes('already taken')) {
        setUsernameError('Username is already taken');
      } else {
        setUsernameError(`Failed to update username: ${errorMessage}`);
      }
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleSave = () => {
    // Apply all temporary settings to store
    setPomodoroDuration(tempTimers.pomodoro);
    setShortBreakDuration(tempTimers.shortBreak);
    setLongBreakDuration(tempTimers.longBreak);
    setPomodorosBeforeLongBreak(tempPomodorosBeforeLongBreak);
    setAutoStartBreaks(tempAutoStartBreaks);
    setAutoStartPomodoros(tempAutoStartPomodoros);
    setSoundEnabled(tempSoundEnabled);
    setVolume(tempVolume);
    setMusicVolume(tempMusicVolume);
    setBackground(tempBackground);
    setLevelSystemEnabled(tempLevelSystemEnabled);

    // Apply ambient volumes
    Object.keys(tempAmbientVolumes).forEach((soundId) => {
      setAmbientVolume(soundId, tempAmbientVolumes[soundId]);
    });

    setIsOpen(false);
  };

  const handleReset = () => {
    // Reset temporary state to current store values
    setTempTimers(timers);
    setTempPomodorosBeforeLongBreak(pomodorosBeforeLongBreak);
    setTempAutoStartBreaks(autoStartBreaks);
    setTempAutoStartPomodoros(autoStartPomodoros);
    setTempSoundEnabled(soundEnabled);
    setTempVolume(volume);
    setTempMusicVolume(musicVolume);
    setTempAmbientVolumes(ambientVolumes);
    setTempBackground(background);
    setTempLevelSystemEnabled(levelSystemEnabled);
    setUsernameInput(username);
  };

  const tabs = [
    { id: 'timer', label: 'General' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'sounds', label: 'Sounds' },
    { id: 'music', label: 'Music' },
    { id: 'progress', label: 'Progress' },
  ] as const;

  if (!isOpen) {
    return (
      <button
        ref={triggerButtonRef}
        onClick={() => setIsOpen(true)}
        aria-label="Open settings"
        className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors border border-white/10"
      >
        <SettingsIcon size={24} />
      </button>
    );
  }

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm ${isMobile ? 'p-2' : 'p-4'}`}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        className={`bg-gray-900 rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden border border-white/10 shadow-2xl flex flex-col ${isMobile ? 'max-h-[90vh]' : ''}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0`}>
          <h2 id="settings-title" className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-white`}>Settings</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Close settings"
          >
            <X size={isMobile ? 18 : 20} className="text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Settings categories"
          className={`flex ${isMobile ? 'gap-1 overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar' : 'gap-1'} px-2 sm:px-4 pt-2 border-b border-white/10 shrink-0`}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              id={`${tab.id}-tab`}
              onClick={() => setActiveTab(tab.id)}
              className={`${isMobile ? 'px-3 py-2 text-xs whitespace-nowrap snap-start' : 'px-4 py-2 text-sm'} font-medium transition-colors relative ${activeTab === tab.id
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-300'
                }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
              )}
            </button>
          ))}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {activeTab === 'timer' && (
              <motion.div
                key="timer"
                role="tabpanel"
                id="timer-panel"
                aria-labelledby="timer-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-white font-bold text-lg mb-4">Timer Durations (minutes)</h3>

                  {/* Pomodoro */}
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-white">Pomodoro</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTempTimers(t => ({ ...t, pomodoro: Math.max(1, t.pomodoro - 1) }))}
                        className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={tempTimers.pomodoro}
                        onChange={(e) => setTempTimers(t => ({ ...t, pomodoro: Number(e.target.value) }))}
                        className="w-16 bg-white/10 text-white text-center px-2 py-1 rounded border border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => setTempTimers(t => ({ ...t, pomodoro: Math.min(60, t.pomodoro + 1) }))}
                        className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Short Break */}
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-white">Short Break</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTempTimers(t => ({ ...t, shortBreak: Math.max(1, t.shortBreak - 1) }))}
                        className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={tempTimers.shortBreak}
                        onChange={(e) => setTempTimers(t => ({ ...t, shortBreak: Number(e.target.value) }))}
                        className="w-16 bg-white/10 text-white text-center px-2 py-1 rounded border border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => setTempTimers(t => ({ ...t, shortBreak: Math.min(60, t.shortBreak + 1) }))}
                        className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Long Break */}
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-white">Long Break</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTempTimers(t => ({ ...t, longBreak: Math.max(1, t.longBreak - 1) }))}
                        className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={tempTimers.longBreak}
                        onChange={(e) => setTempTimers(t => ({ ...t, longBreak: Number(e.target.value) }))}
                        className="w-16 bg-white/10 text-white text-center px-2 py-1 rounded border border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => setTempTimers(t => ({ ...t, longBreak: Math.min(60, t.longBreak + 1) }))}
                        className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-bold text-lg mb-4">Advanced Settings</h3>

                  <div className="flex items-center justify-between mb-4">
                    <label className="text-white">Pomodoros before long break</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={tempPomodorosBeforeLongBreak}
                      onChange={(e) => setTempPomodorosBeforeLongBreak(Number(e.target.value))}
                      className="w-16 bg-white/10 text-white text-center px-2 py-1 rounded border border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <label className="text-white">Auto-start breaks</label>
                    <input
                      type="checkbox"
                      checked={tempAutoStartBreaks}
                      onChange={(e) => setTempAutoStartBreaks(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <label className="text-white">Auto-start pomodoros</label>
                    <input
                      type="checkbox"
                      checked={tempAutoStartPomodoros}
                      onChange={(e) => setTempAutoStartPomodoros(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <label className="text-white">Enable sound notifications</label>
                    <input
                      type="checkbox"
                      checked={tempSoundEnabled}
                      onChange={(e) => setTempSoundEnabled(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <label className="text-white">Enable leveling system</label>
                    <input
                      type="checkbox"
                      checked={tempLevelSystemEnabled}
                      onChange={(e) => setTempLevelSystemEnabled(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Alarm Bell Volume - {tempVolume}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tempVolume}
                    onChange={(e) => setTempVolume(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-blue-500
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-blue-500
                    [&::-moz-range-thumb]:border-0"
                  />
                </div>

                <div>
                  <h3 className="text-white font-bold text-lg mb-3">🔔 Notifications</h3>
                  <p className="text-gray-400 text-sm mb-3">
                    Enable browser notifications to get notified when your timer completes.
                  </p>
                  {('Notification' in window) ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm">Status:</span>
                        <span className={`text-sm font-medium ${notificationPermission === 'granted' ? 'text-green-400' :
                          notificationPermission === 'denied' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                          {notificationPermission === 'granted' ? '✓ Enabled' :
                            notificationPermission === 'denied' ? '✗ Blocked' :
                              '⚠ Not enabled'}
                        </span>
                      </div>
                      {notificationPermission === 'default' && (
                        <button
                          onClick={async () => {
                            const permission = await Notification.requestPermission();
                            if (permission === 'granted') {
                              // Trigger re-render to show updated status
                              window.dispatchEvent(new Event('notificationPermissionChange'));
                            }
                          }}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Enable Notifications
                        </button>
                      )}
                      {notificationPermission === 'denied' && (
                        <p className="text-red-400 text-xs">
                          Notifications are blocked. Please enable them in your browser settings.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400 text-sm">
                      Notifications are not supported in this browser.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'appearance' && (
              <motion.div
                key="appearance"
                role="tabpanel"
                id="appearance-panel"
                aria-labelledby="appearance-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h3 className="text-white font-bold text-lg">Background</h3>
                <div className="grid grid-cols-3 gap-3">
                  {filteredBackgrounds.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setTempBackground(bg.id)}
                      className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-all ${tempBackground === bg.id
                        ? 'border-purple-500 shadow-lg shadow-purple-500/50'
                        : 'border-white/20 hover:border-white/40'
                        }`}
                    >
                      <img
                        src={bg.poster}
                        alt={bg.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">{bg.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'sounds' && (
              <motion.div
                key="sounds"
                role="tabpanel"
                id="sounds-panel"
                aria-labelledby="sounds-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-white font-bold text-lg mb-4">Volume Controls</h3>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-white text-sm">🔊 Main Volume</label>
                      <span className="text-white text-sm">{tempVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={tempVolume}
                      onChange={(e) => setTempVolume(Number(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-blue-500
                      [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-white text-sm">🎵 Music Volume</label>
                      <span className="text-white text-sm">{tempMusicVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={tempMusicVolume}
                      onChange={(e) => setTempMusicVolume(Number(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-gray-500
                      [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-bold text-sm mb-3">🔊 Ambient Sounds</h3>
                  <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-x-4 gap-y-3`}>
                    {AMBIENT_SOUNDS.map((sound) => (
                      <div key={sound.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-white text-sm">{sound.name}</label>
                          <span className="text-white text-sm">{tempAmbientVolumes[sound.id] || 0}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={tempAmbientVolumes[sound.id] || 0}
                          onChange={(e) => setTempAmbientVolumes(v => ({ ...v, [sound.id]: Number(e.target.value) }))}
                          className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
                          [&::-webkit-slider-thumb]:appearance-none
                          [&::-webkit-slider-thumb]:w-4
                          [&::-webkit-slider-thumb]:h-4
                          [&::-webkit-slider-thumb]:rounded-full
                          [&::-webkit-slider-thumb]:bg-white
                          [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'music' && (
              <motion.div
                key="music"
                role="tabpanel"
                id="music-panel"
                aria-labelledby="music-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-white font-bold text-lg mb-2">Music Credits</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    All music tracks are royalty-free and hosted locally for Discord Activity compatibility.
                  </p>
                  <button
                    onClick={() => setShowMusicCredits(true)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
                  >
                    View All Music Credits ({totalTracks} Tracks)
                  </button>
                </div>

                <div>
                  <h3 className="text-white font-bold text-lg mb-2">Copyright Notice</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    If you are a copyright holder and believe any song in this collection infringes on your rights,
                    please contact me and I will remove it immediately.
                  </p>
                  <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors">
                    Contact: lexlarisa@protonmail.com
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'progress' && (
              <motion.div
                key="progress"
                role="tabpanel"
                id="progress-panel"
                aria-labelledby="progress-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-white font-bold text-lg mb-4">Hero Progress</h3>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded-lg p-3 relative overflow-hidden">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-gray-400 text-xs">CURRENT LEVEL</p>
                        {/* Role Toggle Switch */}
                        <label className="relative inline-block w-14 h-7 cursor-pointer shrink-0 ml-2">
                          <input
                            type="checkbox"
                            className="opacity-0 w-0 h-0 peer"
                            checked={levelPath === 'human'}
                            onChange={(e) => handleRoleChange(e.target.checked ? 'human' : 'elf')}
                          />
                          <span className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full transition-all duration-300 shadow-lg peer-checked:from-blue-600 peer-checked:to-blue-700"></span>
                          <span className="absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full transition-all duration-300 flex items-center justify-center text-sm shadow-md peer-checked:translate-x-[28px]">
                            {levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN}
                          </span>
                        </label>
                      </div>
                      <p
                        className="text-white font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full"
                        style={{
                          fontSize: levelNameLabel.length > 18 ? '0.85rem' : levelNameLabel.length > 14 ? '0.95rem' : levelNameLabel.length > 11 ? '1.1rem' : '1.25rem'
                        }}
                      >
                        {level} - {levelNameLabel}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">CURRENT XP</p>
                      <p className="text-white text-xl font-bold">{xp} / {level * 100}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">PRESTIGE LEVEL</p>
                      <p className="text-white text-xl font-bold">{prestigeLevel}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">TOTAL POMODOROS</p>
                      <p className="text-white text-xl font-bold">{totalPomodoros}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 col-span-2">
                      <p className="text-gray-400 text-xs mb-1">TOTAL STUDY TIME</p>
                      <p className="text-white text-xl font-bold">
                        {Math.floor(totalStudyMinutes / 60)}h {totalStudyMinutes % 60}m
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 col-span-2">
                      <p className="text-gray-400 text-xs mb-1">CURRENT BADGE</p>
                      <p className="text-5xl">{getBadgeForLevel(level, prestigeLevel)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-bold text-lg mb-2">Username</h3>
                  <p className="text-gray-400 text-sm mb-3">
                    Change your display name. Free once per week, or costs 50 XP if changed earlier.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => {
                        setUsernameInput(e.target.value.slice(0, 20));
                        setUsernameError(null); // Clear error when typing
                      }}
                      maxLength={20}
                      disabled={usernameLoading}
                      className="flex-1 bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="User"
                    />
                    <button
                      onClick={handleSaveUsername}
                      disabled={usernameLoading}
                      className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {usernameLoading ? 'Saving...' : 'Save Username'}
                    </button>
                  </div>
                  {usernameError && (
                    <p className="text-red-400 text-sm mt-2">
                      ⚠ {usernameError}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-white font-bold text-lg mb-4">Reset Progress</h3>
                  <p className="text-gray-400 text-sm mb-3">
                    This will reset all your progress including level, XP, prestige, and stats.
                    This action cannot be undone.
                  </p>
                  <button
                    onClick={() => {
                      toast('Reset All Progress?', {
                        description: 'This action cannot be undone. All your XP, levels, prestige, and stats will be lost permanently.',
                        duration: 10000,
                        action: {
                          label: 'Reset Everything',
                          onClick: async () => {
                            try {
                              // Reset local state
                              resetProgress();

                              toast.success('All progress has been reset');
                            } catch (error) {
                              console.error('Failed to reset progress:', error);
                              toast.error('Failed to reset progress in database');
                            }
                          }
                        },
                        cancel: {
                          label: 'Cancel',
                          onClick: () => { }
                        }
                      });
                    }}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                  >
                    Reset All Progress
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-white/10 shrink-0">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Role Change Toast Notification */}
      {roleChangeMessage && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-lg shadow-2xl border-2 border-white/20 max-w-sm animate-slide-up z-[100]">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN}</span>
            <div>
              <p className="font-bold text-sm mb-1">Role Changed!</p>
              <p className="text-sm leading-relaxed">{roleChangeMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Music Credits Modal */}
      <AnimatePresence>
        {showMusicCredits && (
          <MusicCreditsModal
            tracks={[...lofiTracks, ...synthwaveTracks] as Track[]}
            onClose={() => setShowMusicCredits(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
