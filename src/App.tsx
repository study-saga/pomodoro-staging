import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { VideoBackground } from './components/background/VideoBackground';
import { PomodoroTimer } from './components/timer/PomodoroTimer';
import { MusicPlayer } from './components/music/MusicPlayer';
import { AmbientSoundsPlayer } from './components/music/AmbientSoundsPlayer';
import { LevelDisplay } from './components/level/LevelDisplay';
import { SettingsPopover } from './components/settings/SettingsPopover';
import { ScaleProvider } from './components/ScaleProvider';
import { OnlinePresenceCounter } from './components/presence/OnlinePresenceCounter';
import { DailyGiftGrid } from './components/rewards/DailyGiftGrid';
import { ActiveBoostIndicator } from './components/buffs/ActiveBoostIndicator';
import { LoginScreen } from './components/auth/LoginScreen';
import DiscordButton from './components/DiscordButton';
import { ChatContainer } from './components/chat/ChatContainer';
import { useSettingsSync } from './hooks/useSettingsSync';
import { useSettingsStore } from './store/useSettingsStore';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { getEnvironment } from './lib/environment';
import { canClaimDailyGift } from './lib/userSyncAuth';

function AppContent() {
  const { authenticated, loading, error, appUser } = useAuth();
  const settingsSyncComplete = useSettingsStore((state) => state.settingsSyncComplete);

  // Enable cross-device settings sync
  useSettingsSync();

  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showDailyGift, setShowDailyGift] = useState(false);
  const [dailyGiftClaimed, setDailyGiftClaimed] = useState(false);

  // Check if daily gift available (actual claim happens in DailyGiftGrid to prevent double-claiming)
  useEffect(() => {
    // Wait for settings sync to complete (has DB state)
    if (!settingsSyncComplete || !appUser?.id || dailyGiftClaimed) return;

    // Check if gift available (doesn't claim, just checks eligibility)
    canClaimDailyGift(appUser.id, appUser.discord_id)
      .then((canClaim) => {
        setDailyGiftClaimed(true); // Prevent re-checking

        if (canClaim) {
          // Show daily gift modal - DailyGiftGrid will handle actual claim
          setShowDailyGift(true);
          console.log('[Daily Gift] Gift available, showing modal');
        } else {
          console.log('[Daily Gift] Already claimed today');
        }
      })
      .catch((error) => {
        console.error('[Daily Gift] Failed to check gift status:', error);
        setDailyGiftClaimed(true); // Prevent retry loop
      });
  }, [settingsSyncComplete, appUser?.id, appUser?.discord_id, dailyGiftClaimed]);

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
    <ScaleProvider baseWidth={1280} baseHeight={720}>
      <div className="relative w-[1280px] h-[720px] overflow-hidden flex flex-col">
        {/* Video Background */}
        <VideoBackground />

        {/* Level Display (Top Left) */}
        <LevelDisplay onOpenDailyGift={() => setShowDailyGift(true)} />

        {/* Online Presence Counter (Top Right, below settings button) */}
        <div className="fixed top-20 right-4 z-10">
          <OnlinePresenceCounter />
        </div>

        {/* Main Content - Centered Timer */}
        <div className="flex-1 flex items-center justify-center px-4">
          <PomodoroTimer />
        </div>

        {/* Music Player (Bottom) */}
        <MusicPlayer playing={musicPlaying} setPlaying={setMusicPlaying} />

        {/* Ambient Sounds Player (Hidden) */}
        <AmbientSoundsPlayer musicPlaying={musicPlaying} />

        {/* Daily Gift Grid */}
        <DailyGiftGrid
          show={showDailyGift}
          onClose={() => setShowDailyGift(false)}
        />

        {/* Active Boost Indicator */}
        <ActiveBoostIndicator />

        {/* Top Right Buttons - Discord & Settings */}
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2">
          <DiscordButton />
          <SettingsPopover />
        </div>

        {/* Chat Container (Bottom Left) */}
        <ChatContainer />

        {/* Toaster for notifications */}
        <Toaster position="top-center" />
      </div>
    </ScaleProvider>
  );
}

// Wrapper component with providers
function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
