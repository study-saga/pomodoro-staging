import { useState, useEffect, Suspense } from 'react';
import { Toaster } from 'sonner';

import { VideoBackground } from './components/background/VideoBackground';
import { PomodoroTimer } from './components/timer/PomodoroTimer';
import { MusicPlayer, DailyGiftGrid, ChatContainer } from './components/lazy';
import { AmbientSoundsPlayer } from './components/music/AmbientSoundsPlayer';
import { LevelDisplay } from './components/level/LevelDisplay';
import { SettingsPopover } from './components/settings/SettingsPopover';
import { OnlinePresenceCounter } from './components/presence/OnlinePresenceCounter';
import { ActiveBoostIndicator } from './components/buffs/ActiveBoostIndicator';
import { LoginScreen } from './components/auth/LoginScreen';
import DiscordButton from './components/DiscordButton';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AdminActionHandler } from './components/admin/AdminActionHandler';
import { ChunkLoadErrorBoundary } from './components/ChunkLoadErrorBoundary';
import { SnowOverlay } from './components/effects/SnowOverlay';
import { useSettingsSync } from './hooks/useSettingsSync';
import { useBuffActivation } from './hooks/useBuffActivation';
import { useSettingsStore } from './store/useSettingsStore';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { getEnvironment } from './lib/environment';
import { canClaimDailyGift } from './lib/userSyncAuth';
import { useSmartPIPMode } from './hooks/useSmartPIPMode';


function AppContent() {
  const { authenticated, loading, error, appUser } = useAuth();
  const settingsSyncComplete = useSettingsStore((state) => state.settingsSyncComplete);

  // Enable cross-device settings sync
  useSettingsSync();

  // Auto-activate event buffs (slingshot for elves, etc.)
  useBuffActivation();

  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showDailyGift, setShowDailyGift] = useState(false);
  const [dailyGiftClaimed, setDailyGiftClaimed] = useState(false);
  const isPIPMode = useSmartPIPMode(750);

  // Check if daily gift available (actual claim happens in DailyGiftGrid to prevent double-claiming)
  useEffect(() => {
    // Wait for settings sync to complete (has DB state)
    if (!settingsSyncComplete || !appUser?.id || dailyGiftClaimed) return;

    // Check if gift available (doesn't claim, just checks eligibility)
    canClaimDailyGift(appUser.id)
      .then((canClaim) => {
        setDailyGiftClaimed(true); // Prevent re-checking

        if (canClaim) {
          // Show daily gift modal - DailyGiftGrid will handle actual claim
          setShowDailyGift(true);
          import.meta.env.DEV && console.log('[Daily Gift] Gift available, showing modal');
        } else {
          import.meta.env.DEV && console.log('[Daily Gift] Already claimed today');
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
            <div className="relative inline-block mb-8">
              <div className="bounce-loader">
                <div className="circle" />
                <div className="circle" />
                <div className="circle" />
                <div className="shadow" />
                <div className="shadow" />
                <div className="shadow" />
              </div>
            </div>
            <p className="text-white text-xl font-medium">Connecting to Discord...</p>
            <p className="text-white/60 text-sm mt-2">Please wait while we authenticate your account</p>
          </div>
        </div>
        <style>{`
          .bounce-loader {
            width: 200px;
            height: 60px;
            position: relative;
            z-index: 1;
          }

          .circle {
            width: 20px;
            height: 20px;
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.94);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            left: 15%;
            transform-origin: 50%;
            animation: circle7124 .5s alternate infinite ease;
            animation-delay: .15s;
          }

          @keyframes circle7124 {
            0% {
              top: 60px;
              height: 5px;
              border-radius: 50px 50px 25px 25px;
              transform: scaleX(1.7);
            }

            40% {
              height: 20px;
              border-radius: 50%;
              transform: scaleX(1);
            }

            100% {
              top: 0%;
            }
          }

          .circle:nth-child(2) {
            left: 45%;
            animation-delay: .3s;
          }

          .circle:nth-child(3) {
            left: auto;
            right: 15%;
            animation-delay: .45s;
          }

          .shadow {
            width: 20px;
            height: 4px;
            border-radius: 50%;
            background-color: rgba(0, 0, 0, 0.4);
            position: absolute;
            top: 62px;
            transform-origin: 50%;
            z-index: -1;
            left: 15%;
            filter: blur(2px);
            animation: shadow046 .5s alternate infinite ease;
            animation-delay: .15s;
          }

          @keyframes shadow046 {
            0% {
              transform: scaleX(1.5);
            }

            40% {
              transform: scaleX(1);
              opacity: .7;
            }

            100% {
              transform: scaleX(.2);
              opacity: .4;
            }
          }

          .shadow:nth-child(4) {
            left: 45%;
            animation-delay: .3s;
          }

          .shadow:nth-child(5) {
            left: auto;
            right: 15%;
            animation-delay: .45s;
          }
        `}</style>
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
    <div className="relative h-screen overflow-hidden flex flex-col">
      {/* Video Background */}
      <VideoBackground />

      {/* Snow Effect */}
      <SnowOverlay />

      {/* Level Display (Top Left) */}
      <LevelDisplay />

      {/* Online Presence Counter (Top Right, below settings button) */}
      {!isPIPMode && (
        <div className="fixed top-20 right-4 z-10">
          <OnlinePresenceCounter />
        </div>
      )}

      {/* Main Content - Centered Timer */}
      <div className="flex-1 flex items-center justify-center px-4">
        <PomodoroTimer />
      </div>

      {/* Music Player (Bottom) - Always mounted, UI hidden in PiP */}
      <Suspense fallback={<LoadingSpinner />}>
        <MusicPlayer
          playing={musicPlaying}
          setPlaying={setMusicPlaying}
          isPIPMode={isPIPMode}
        />
      </Suspense>

      {/* Ambient Sounds Player (Hidden) - Always playing, even in PiP */}
      <AmbientSoundsPlayer musicPlaying={musicPlaying} />

      {/* Daily Gift Grid */}
      <ChunkLoadErrorBoundary
        fallback={
          <div className="flex items-center justify-center p-8">
            <div className="text-gray-400">Failed to load rewards calendar</div>
          </div>
        }
        onError={(error) => {
          console.error('[DailyGiftGrid] Chunk load failed:', error);
        }}
      >
        <Suspense fallback={<LoadingSpinner />}>
          <DailyGiftGrid
            show={showDailyGift}
            onClose={() => setShowDailyGift(false)}
          />
        </Suspense>
      </ChunkLoadErrorBoundary>

      {/* Active Boost Indicator */}
      {!isPIPMode && <ActiveBoostIndicator />}

      {/* Top Right Buttons - Discord & Settings */}
      {!isPIPMode && (
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2">
          {/* Sentry Test Button */}

          <DiscordButton />
          <SettingsPopover />
        </div>
      )}

      {/* Chat Container (Bottom Left) */}
      {!isPIPMode && (
        <ChunkLoadErrorBoundary
          onError={(error) => console.error('[ChatContainer] Chunk load failed:', error)}
        >
          <Suspense fallback={<LoadingSpinner />}>
            <ChatContainer />
          </Suspense>
        </ChunkLoadErrorBoundary>
      )}

      {/* Toaster for notifications */}
      <Toaster position="top-center" />

      {/* Admin Action Handler (URL params) */}
      <AdminActionHandler />
    </div>
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
