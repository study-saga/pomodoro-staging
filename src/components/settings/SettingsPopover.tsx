import { memo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, X, Palette, Volume2, Music, BarChart, Sparkles, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useSettingsStore } from '../../store/useSettingsStore';
import { BACKGROUNDS } from '../../data/constants';
import {
  ROLE_EMOJI_ELF,
  ROLE_EMOJI_HUMAN,
} from '../../data/levels';
import { useAuth } from '../../contexts/AuthContext';
import { updateUsernameSecure, checkUsernameAvailability } from '../../lib/userSyncAuth';

import { showGameToast } from '../ui/GameToast';
import { MusicCreditsModal } from './MusicCreditsModal';
import { SettingsContent } from './SettingsContent';
import { ScrollArea } from '../ui/scroll-area';
import type { Track } from '../../types';
import lofiTracks from '../../data/lofi.json';
import synthwaveTracks from '../../data/synthwave.json';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
} from '../ui/popover';
import { createRateLimiter } from '../../utils/rateLimiters';

export const SettingsPopover = memo(function SettingsPopover() {
  const { appUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'timer' | 'appearance' | 'sounds' | 'notifications' | 'music' | 'progress' | 'whats-new'>('timer');
  const [roleChangeMessage, setRoleChangeMessage] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [showMusicCredits, setShowMusicCredits] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return 'default';
    }
    return Notification.permission;
  });
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const rateLimiterRef = useRef(createRateLimiter(720000)); // 12 minutes (5 changes per hour)

  const { isPortrait, isCompact } = useDeviceType();

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
    if (open) {
      modalRef.current?.focus();
    } else {
      triggerButtonRef.current?.focus();
    }
  }, [open]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyboard = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Escape to close
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }

      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      // Number keys 1-7 to jump to tabs
      const numKey = parseInt(e.key);
      if (numKey >= 1 && numKey <= tabs.length) {
        setActiveTab(tabs[numKey - 1].id as typeof activeTab);
        return;
      }

      // Arrow keys to navigate tabs
      const currentIndex = tabs.findIndex(t => t.id === activeTab);
      if (e.key === 'ArrowDown' && currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1].id as typeof activeTab);
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1].id as typeof activeTab);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [open, activeTab]);

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
    levelSystemEnabled,
    setLevelSystemEnabled,
    levelPath,
    setLevelPath,
    totalUniqueDays,
    consecutiveLoginDays,
    pomodoroBoostActive,
    pomodoroBoostExpiresAt,
    firstLoginDate,
  } = useSettingsStore();

  // Filter backgrounds based on viewport orientation (portrait vs landscape)
  const targetOrientation = isPortrait ? 'vertical' : 'horizontal';
  const filteredBackgrounds = BACKGROUNDS.filter(bg => bg.orientation === targetOrientation);

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

  // Check for unsaved changes
  const hasUnsavedChanges =
    JSON.stringify(tempTimers) !== JSON.stringify(timers) ||
    tempPomodorosBeforeLongBreak !== pomodorosBeforeLongBreak ||
    tempAutoStartBreaks !== autoStartBreaks ||
    tempAutoStartPomodoros !== autoStartPomodoros ||
    tempSoundEnabled !== soundEnabled ||
    tempVolume !== volume ||
    tempMusicVolume !== musicVolume ||
    JSON.stringify(tempAmbientVolumes) !== JSON.stringify(ambientVolumes) ||
    tempBackground !== background ||
    tempLevelSystemEnabled !== levelSystemEnabled;

  // Reset temporary state when modal opens
  useEffect(() => {
    if (open) {
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
      setActiveTab('timer'); // Default to General tab
    }
  }, [open, timers, pomodorosBeforeLongBreak, autoStartBreaks, autoStartPomodoros, soundEnabled, volume, musicVolume, ambientVolumes, background, levelSystemEnabled, username]);

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

    setOpen(false);
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
    { id: 'timer', label: 'Timer', icon: SettingsIcon },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'sounds', label: 'Sounds', icon: Volume2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'progress', label: 'Progress', icon: BarChart },
    { id: 'whats-new', label: "What's New", icon: Sparkles },
  ] as const;

  // Trigger button component
  const trigger = (
    <button
      ref={triggerButtonRef}
      onClick={() => setOpen(true)}
      aria-label="Open settings"
      className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors border border-white/10"
    >
      <SettingsIcon size={24} />
    </button>
  );

  return (
    <>
      {/* Desktop: Popover */}
      {!isCompact && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {trigger}
          </PopoverTrigger>
          <PopoverContent
            className="bg-gray-900/95 backdrop-blur-xl border-white/10 rounded-2xl w-[594px] p-0 max-h-[85vh] z-[100]"
            align="end"
            side="bottom"
            sideOffset={8}
          >
            <PopoverBody className="p-0">
              <div
                ref={modalRef}
                tabIndex={-1}
                className="flex flex-col max-h-[85vh]"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                  <h2 className="text-lg font-bold text-white">Settings</h2>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Close settings"
                  >
                    <X size={20} className="text-white" />
                  </button>
                </div>

                {/* Sidebar + Content Layout */}
                <div className="flex flex-1 overflow-hidden min-w-0">
                  {/* Vertical Sidebar */}
                  <div
                    role="tablist"
                    aria-label="Settings categories"
                    className="w-[160px] border-r border-white/10 shrink-0 py-2"
                  >
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      const isWhatsNew = tab.id === 'whats-new';
                      return (
                        <button
                          key={tab.id}
                          role="tab"
                          aria-selected={activeTab === tab.id}
                          aria-controls={`${tab.id}-panel`}
                          id={`${tab.id}-tab`}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full px-4 py-3 text-sm font-medium transition-colors flex items-center gap-3 relative ${isWhatsNew ? 'mt-2 pt-5 border-t border-white/10' : ''
                            } ${activeTab === tab.id
                              ? 'text-white bg-white/5'
                              : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                            }`}
                        >
                          {activeTab === tab.id && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-500" />
                          )}
                          <Icon size={18} className="shrink-0" />
                          <span className="truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Content - Scrollable */}
                  <ScrollArea className="flex-1 overflow-y-auto max-w-full">
                    <div className="p-6 w-full max-w-full overflow-hidden min-w-0">
                      <SettingsContent
                        activeTab={activeTab}
                        isMobile={false}
                        tempTimers={tempTimers}
                        setTempTimers={setTempTimers}
                        tempPomodorosBeforeLongBreak={tempPomodorosBeforeLongBreak}
                        setTempPomodorosBeforeLongBreak={setTempPomodorosBeforeLongBreak}
                        tempAutoStartBreaks={tempAutoStartBreaks}
                        setTempAutoStartBreaks={setTempAutoStartBreaks}
                        tempAutoStartPomodoros={tempAutoStartPomodoros}
                        setTempAutoStartPomodoros={setTempAutoStartPomodoros}
                        tempSoundEnabled={tempSoundEnabled}
                        setTempSoundEnabled={setTempSoundEnabled}
                        tempVolume={tempVolume}
                        setTempVolume={setTempVolume}
                        tempLevelSystemEnabled={tempLevelSystemEnabled}
                        setTempLevelSystemEnabled={setTempLevelSystemEnabled}
                        notificationPermission={notificationPermission}
                        tempBackground={tempBackground}
                        setTempBackground={setTempBackground}
                        filteredBackgrounds={filteredBackgrounds}
                        tempMusicVolume={tempMusicVolume}
                        setTempMusicVolume={setTempMusicVolume}
                        tempAmbientVolumes={tempAmbientVolumes}
                        setTempAmbientVolumes={setTempAmbientVolumes}
                        totalTracks={totalTracks}
                        setShowMusicCredits={setShowMusicCredits}
                        level={level}
                        xp={xp}
                        prestigeLevel={prestigeLevel}
                        totalPomodoros={totalPomodoros}
                        totalStudyMinutes={totalStudyMinutes}
                        levelPath={levelPath}
                        handleRoleChange={handleRoleChange}
                        usernameInput={usernameInput}
                        setUsernameInput={setUsernameInput}
                        usernameError={usernameError}
                        setUsernameError={setUsernameError}
                        usernameLoading={usernameLoading}
                        handleSaveUsername={handleSaveUsername}
                        resetProgress={resetProgress}
                        totalUniqueDays={totalUniqueDays}
                        consecutiveLoginDays={consecutiveLoginDays}
                        pomodoroBoostActive={pomodoroBoostActive}
                        pomodoroBoostExpiresAt={pomodoroBoostExpiresAt}
                        firstLoginDate={firstLoginDate}
                      />
                    </div>
                  </ScrollArea>
                </div>

                {/* Footer */}
                <div className="border-t border-white/10 shrink-0">
                  {hasUnsavedChanges && (
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-xs text-yellow-400">⚠ Unsaved changes</p>
                    </div>
                  )}
                  <div className="flex gap-3 p-4 pt-2">
                    <button
                      onClick={handleReset}
                      className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!hasUnsavedChanges}
                      className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${hasUnsavedChanges
                        ? 'bg-white text-black hover:bg-gray-200'
                        : 'bg-white/20 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      )}

      {/* Mobile: Centered Modal */}
      {isCompact && (
        <>
          <div onClick={() => setOpen(!open)}>
            {trigger}
          </div>

          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 flex items-center justify-center z-[100] p-2">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setOpen(false)}
                />

                {/* Modal Content */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="relative z-[110] bg-gray-900/95 backdrop-blur-xl border-white/10 border rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                    <h2 className="text-lg font-bold text-white">Settings</h2>
                    <button
                      onClick={() => setOpen(false)}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors"
                      aria-label="Close settings"
                    >
                      <X size={20} className="text-white" />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div
                    role="tablist"
                    aria-label="Settings categories"
                    className="flex gap-1 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 pt-4 border-b border-white/10 shrink-0"
                  >
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          role="tab"
                          aria-selected={activeTab === tab.id}
                          aria-controls={`${tab.id}-panel`}
                          id={`${tab.id}-tab`}
                          onClick={() => setActiveTab(tab.id)}
                          className={`px-3 py-2 text-sm whitespace-nowrap snap-start font-medium transition-colors relative flex items-center gap-2 ${activeTab === tab.id
                            ? 'text-white'
                            : 'text-gray-400 hover:text-gray-300'
                            }`}
                        >
                          <Icon size={16} />
                          {tab.label}
                          {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Content - Scrollable */}
                  <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="p-4">
                      <SettingsContent
                        activeTab={activeTab}
                        isMobile={true}
                        tempTimers={tempTimers}
                        setTempTimers={setTempTimers}
                        tempPomodorosBeforeLongBreak={tempPomodorosBeforeLongBreak}
                        setTempPomodorosBeforeLongBreak={setTempPomodorosBeforeLongBreak}
                        tempAutoStartBreaks={tempAutoStartBreaks}
                        setTempAutoStartBreaks={setTempAutoStartBreaks}
                        tempAutoStartPomodoros={tempAutoStartPomodoros}
                        setTempAutoStartPomodoros={setTempAutoStartPomodoros}
                        tempSoundEnabled={tempSoundEnabled}
                        setTempSoundEnabled={setTempSoundEnabled}
                        tempVolume={tempVolume}
                        setTempVolume={setTempVolume}
                        tempLevelSystemEnabled={tempLevelSystemEnabled}
                        setTempLevelSystemEnabled={setTempLevelSystemEnabled}
                        notificationPermission={notificationPermission}
                        tempBackground={tempBackground}
                        setTempBackground={setTempBackground}
                        filteredBackgrounds={filteredBackgrounds}
                        tempMusicVolume={tempMusicVolume}
                        setTempMusicVolume={setTempMusicVolume}
                        tempAmbientVolumes={tempAmbientVolumes}
                        setTempAmbientVolumes={setTempAmbientVolumes}
                        totalTracks={totalTracks}
                        setShowMusicCredits={setShowMusicCredits}
                        level={level}
                        xp={xp}
                        prestigeLevel={prestigeLevel}
                        totalPomodoros={totalPomodoros}
                        totalStudyMinutes={totalStudyMinutes}
                        levelPath={levelPath}
                        handleRoleChange={handleRoleChange}
                        usernameInput={usernameInput}
                        setUsernameInput={setUsernameInput}
                        usernameError={usernameError}
                        setUsernameError={setUsernameError}
                        usernameLoading={usernameLoading}
                        handleSaveUsername={handleSaveUsername}
                        resetProgress={resetProgress}
                        totalUniqueDays={totalUniqueDays}
                        consecutiveLoginDays={consecutiveLoginDays}
                        pomodoroBoostActive={pomodoroBoostActive}
                        pomodoroBoostExpiresAt={pomodoroBoostExpiresAt}
                        firstLoginDate={firstLoginDate}
                      />
                    </div>
                  </ScrollArea>

                  {/* Footer */}
                  <div className="border-t border-white/10 shrink-0">
                    {hasUnsavedChanges && (
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-xs text-yellow-400">⚠ Unsaved changes</p>
                      </div>
                    )}
                    <div className="flex gap-3 p-4 pt-2">
                      <button
                        onClick={handleReset}
                        className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={!hasUnsavedChanges}
                        className={`flex-1 px-4 py-2 font-medium rounded-lg transition-colors ${hasUnsavedChanges
                          ? 'bg-white text-black hover:bg-gray-200'
                          : 'bg-white/20 text-gray-500 cursor-not-allowed'
                          }`}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}

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
    </>
  );
});
