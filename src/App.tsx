import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { VideoBackground } from './components/background/VideoBackground';
import { PomodoroTimer } from './components/timer/PomodoroTimer';
import { MusicPlayer } from './components/music/MusicPlayer';
import { AmbientSoundsPlayer } from './components/music/AmbientSoundsPlayer';
import { LevelDisplay } from './components/level/LevelDisplay';
import { LevelUpCelebration } from './components/level/LevelUpCelebration';
import { RoleSwitch } from './components/level/RoleSwitch';
import { RoleSwitchComparison } from './components/level/RoleSwitchComparison';
import { SocialNodes } from './components/level/SocialNodes';
import { SettingsModal } from './components/settings/SettingsModal';
import { OnlinePresenceCounter } from './components/presence/OnlinePresenceCounter';
import { DailyGiftGrid } from './components/rewards/DailyGiftGrid';
import { LoginScreen } from './components/auth/LoginScreen';
import DiscordButton from './components/DiscordButton';
import WhatsNewButton from './components/WhatsNewButton';
import { useLevelNotifications } from './hooks/useLevelNotifications';
import { useSettingsSync } from './hooks/useSettingsSync';
import { useSettingsStore } from './store/useSettingsStore';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getEnvironment } from './lib/environment';
import { claimDailyGiftXP } from './lib/userSyncAuth';
import { showGameToast } from './components/ui/GameToast';

function AppContent() {
  const { authenticated, loading, error, appUser } = useAuth();
  const { showLevelUp, levelUpData } = useLevelNotifications();
  const addXP = useSettingsStore((state) => state.addXP);
  const consecutiveLoginDays = useSettingsStore((state) => state.consecutiveLoginDays);
  const settingsSyncComplete = useSettingsStore((state) => state.settingsSyncComplete);

  // Enable cross-device settings sync
  useSettingsSync();

  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showDailyGift, setShowDailyGift] = useState(false);
  const [dailyGiftClaimed, setDailyGiftClaimed] = useState(false);

  // Claim daily gift with server-side validation (prevents XP exploit)
  useEffect(() => {
    // Wait for settings sync to complete (has DB state)
    if (!settingsSyncComplete || !appUser?.id || dailyGiftClaimed) return;

    // Attempt to claim daily gift from server
    claimDailyGiftXP(appUser.id, appUser.discord_id)
      .then((result) => {
        setDailyGiftClaimed(true);

        if (result.success) {
          // Server validated and awarded XP - update local state
          const minutes = result.xpAwarded / 2;
          addXP(minutes);

          // Update consecutive days in store
          useSettingsStore.setState({
            consecutiveLoginDays: result.consecutiveDays
          });

          // Show daily gift modal
          setShowDailyGift(true);

          // Show XP toast
          showGameToast(`+${result.xpAwarded} XP Collected! 🎉`);
          console.log('[Daily Gift] Claimed successfully:', result);
        } else {
          // Already claimed today - server rejected
          console.log('[Daily Gift] Already claimed today');
        }
      })
      .catch((error) => {
        console.error('[Daily Gift] Failed to claim:', error);
        setDailyGiftClaimed(true); // Prevent retry loop
      });
  }, [settingsSyncComplete, appUser?.id, appUser?.discord_id, dailyGiftClaimed, addXP]);

  // Loading state
  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <VideoBackground />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mb-4"></div>
            <p className="text-white text-xl font-medium">Connecting to Discord...</p>
            <p className="text-white/60 text-sm mt-2">Please wait while we authenticate your account</p>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!authenticated) {
    const environment = getEnvironment();

    // Browser: Show login screen
    if (environment === 'browser') {
      return <LoginScreen />;
    }

    // Discord with error: Show error message
    if (error) {
      return (
        <div className="relative min-h-screen overflow-hidden">
          <VideoBackground />
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-4">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-white text-2xl font-bold mb-2">
                Authentication Failed
              </h1>
              <p className="text-white/80 mb-4">
                {error || 'Unable to connect to Discord. Please try again.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-white text-gray-900 rounded-lg font-bold hover:bg-gray-100 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Authenticated - show main app
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Video Background */}
      <VideoBackground />

      {/* Level Display (Top Left) */}
      <LevelDisplay onOpenDailyGift={() => setShowDailyGift(true)} />

      {/* Role Switch Comparison (Below Level Display) */}
      <RoleSwitchComparison />

      {/* Social Nodes (Below Role Switch) */}
      <SocialNodes />

      {/* Online Presence Counter (Top Right, below settings button) */}
      <div className="fixed top-20 right-4 z-10">
        <OnlinePresenceCounter />
      </div>

      {/* Main Content - Centered Timer */}
      <div className="min-h-screen flex items-center justify-center pb-32 md:pb-20 pt-8 sm:pt-0">
        <PomodoroTimer />
      </div>

      {/* Music Player (Bottom) */}
      <MusicPlayer playing={musicPlaying} setPlaying={setMusicPlaying} />

      {/* Ambient Sounds Player (Hidden) */}
      <AmbientSoundsPlayer musicPlaying={musicPlaying} />

      {/* Level Up Celebration */}
      <LevelUpCelebration
        show={showLevelUp}
        level={levelUpData.level}
        levelName={levelUpData.levelName}
      />

      {/* Daily Gift Grid */}
      <DailyGiftGrid
        show={showDailyGift}
        onClose={() => setShowDailyGift(false)}
        currentDay={consecutiveLoginDays}
      />

      {/* Top Right Buttons - What's New, Discord & Settings */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <WhatsNewButton />
        <DiscordButton />
        <SettingsModal />
      </div>

      {/* Toaster for notifications */}
      <Toaster position="top-center" />
    </div>
  );
}

// Wrapper component with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
