import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { X, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../../store/useSettingsStore';
import { BACKGROUNDS } from '../../data/constants';
import { useDeviceType } from '../../hooks/useDeviceType';
import {
  ROLE_EMOJI_ELF,
  ROLE_EMOJI_HUMAN,
  getLevelName,
} from '../../data/levels';
import { useAuth } from '../../contexts/AuthContext';
import { updateUsernameSecure, checkUsernameAvailability } from '../../lib/userSyncAuth';
// ... (imports remain unchanged)

// ... (inside component)

import { showGameToast } from '../ui/GameToast';
import { MusicCreditsModal } from '../lazy';
import { LoadingSpinner } from '../LoadingSpinner';
import type { Track } from '../../types';
import lofiTracks from '../../data/lofi.json';
import synthwaveTracks from '../../data/synthwave.json';
import { createRateLimiter } from '../../utils/rateLimiters';
import { TimerTab, AppearanceTab, SoundsTab, MusicTab, ProgressTab } from './tabs';

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
    playlist,
    setPlaylist,
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
  const [tempPlaylist, setTempPlaylist] = useState(playlist);
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
      setTempPlaylist(playlist);
      setUsernameInput(username);
    }
  }, [isOpen, timers, pomodorosBeforeLongBreak, autoStartBreaks, autoStartPomodoros, soundEnabled, volume, musicVolume, ambientVolumes, background, levelSystemEnabled, playlist, username]);

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
    setPlaylist(tempPlaylist);

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
    setTempPlaylist(playlist);
    setUsernameInput(username);
  };

  const tabs = [
    { id: 'timer', label: 'General' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'sounds', label: 'Sounds' },
    { id: 'progress', label: 'Progress' },
    { id: 'music', label: 'Credits' },
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
              <TimerTab
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
                tempLevelSystemEnabled={tempLevelSystemEnabled}
                setTempLevelSystemEnabled={setTempLevelSystemEnabled}
                tempVolume={tempVolume}
                setTempVolume={setTempVolume}
                notificationPermission={notificationPermission}
              />
            )}

            {activeTab === 'appearance' && (
              <AppearanceTab
                filteredBackgrounds={filteredBackgrounds}
                tempBackground={tempBackground}
                setTempBackground={setTempBackground}
              />
            )}

            {activeTab === 'sounds' && (
              <SoundsTab
                tempVolume={tempVolume}
                setTempVolume={setTempVolume}
                tempMusicVolume={tempMusicVolume}
                setTempMusicVolume={setTempMusicVolume}
                tempAmbientVolumes={tempAmbientVolumes}
                setTempAmbientVolumes={setTempAmbientVolumes}
                tempPlaylist={tempPlaylist}
                setTempPlaylist={setTempPlaylist}
                isMobile={isMobile}
              />
            )}

            {activeTab === 'music' && (
              <MusicTab
                setShowMusicCredits={setShowMusicCredits}
                totalTracks={totalTracks}
              />
            )}

            {activeTab === 'progress' && (
              <ProgressTab
                levelPath={levelPath}
                handleRoleChange={handleRoleChange}
                level={level}
                levelNameLabel={levelNameLabel}
                xp={xp}
                prestigeLevel={prestigeLevel}
                totalPomodoros={totalPomodoros}
                totalStudyMinutes={totalStudyMinutes}
                usernameInput={usernameInput}
                setUsernameInput={setUsernameInput}
                handleSaveUsername={handleSaveUsername}
                usernameError={usernameError}
                setUsernameError={setUsernameError}
                usernameLoading={usernameLoading}
                resetProgress={resetProgress}
              />
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
          <Suspense fallback={<LoadingSpinner />}>
            <MusicCreditsModal
              tracks={[...lofiTracks, ...synthwaveTracks] as Track[]}
              onClose={() => setShowMusicCredits(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
