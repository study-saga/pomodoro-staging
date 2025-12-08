import { useState, useEffect, useRef } from 'react';
// @ts-ignore - No types available for react-howler
import ReactHowler from 'react-howler';
import { Howler } from 'howler';
import { Play, Pause, SkipBack, SkipForward, Volume2, ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Track } from '../../types';
import { useSettingsStore } from '../../store/useSettingsStore';
import { BACKGROUNDS } from '../../data/constants';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useMouseActivity } from '../../hooks/useMouseActivity';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import lofiTracks from '../../data/lofi.json';
import synthwaveTracks from '../../data/synthwave.json';

interface MusicPlayerProps {
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  isPIPMode?: boolean;
}

export function MusicPlayer({ playing, setPlaying, isPIPMode = false }: MusicPlayerProps) {
  const isMouseActive = useMouseActivity(8000); // 8 seconds

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlistState, setPlaylistState] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [seek, setSeek] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showBackgrounds, setShowBackgrounds] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const { isMobile, isPortrait } = useDeviceType();

  // Filter backgrounds based on viewport orientation (portrait vs landscape)
  const targetOrientation = isPortrait ? 'vertical' : 'horizontal';
  const filteredBackgrounds = BACKGROUNDS.filter(bg => bg.orientation === targetOrientation);

  const playerRef = useRef<any>(null);

  const musicVolume = useSettingsStore((state) => state.musicVolume);
  const setMusicVolume = useSettingsStore((state) => state.setMusicVolume);
  const background = useSettingsStore((state) => state.background);
  const setBackground = useSettingsStore((state) => state.setBackground);
  const playlist = useSettingsStore((state) => state.playlist);
  const setPlaylist = useSettingsStore((state) => state.setPlaylist);
  const autoHideUI = useSettingsStore((state) => state.autoHideUI);

  // Load and shuffle playlist
  useEffect(() => {
    const tracks = playlist === 'lofi' ? (lofiTracks as Track[]) : (synthwaveTracks as Track[]);
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    setPlaylistState(shuffled);
    setCurrentIndex(0);
    if (shuffled.length > 0) {
      setCurrentTrack(shuffled[0]);
    }
  }, [playlist]);

  // Close background selector when mouse becomes inactive
  useEffect(() => {
    if (!isMouseActive && showBackgrounds) {
      setShowBackgrounds(false);
    }
  }, [isMouseActive, showBackgrounds]);

  // Update seek position
  useEffect(() => {
    let lastUpdate = 0;
    let rafId: number;

    const updateSeek = (timestamp: number) => {
      if (timestamp - lastUpdate >= 250) { // 250ms = 4 updates/sec
        if (playerRef.current && playing) {
          setSeek(playerRef.current.seek() as number);
        }
        lastUpdate = timestamp;
      }
      rafId = requestAnimationFrame(updateSeek);
    };

    if (playing) {
      rafId = requestAnimationFrame(updateSeek);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [playing]);

  // Handle audio context resumption on mobile lock/unlock
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Page became visible (user unlocked phone or switched back to tab)
        try {
          // Resume the Howler audio context if it's suspended
          if (Howler.ctx && Howler.ctx.state === 'suspended') {
            await Howler.ctx.resume();
            import.meta.env.DEV && console.log('[MusicPlayer] Audio context resumed');
          }

          // If music was playing before lock, ensure it continues
          if (playing && playerRef.current) {
            // Force a small seek to re-trigger playback
            const currentSeek = playerRef.current.seek();
            playerRef.current.seek(currentSeek);
          }
        } catch (error) {
          console.error('[MusicPlayer] Failed to resume audio context:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [playing]);

  const handlePlayPause = () => {
    setPlaying(!playing);
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % playlistState.length;
    setCurrentIndex(nextIndex);
    setCurrentTrack(playlistState[nextIndex]);
    setSeek(0);
  };

  const handlePrevious = () => {
    const prevIndex = currentIndex === 0 ? playlistState.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    setCurrentTrack(playlistState[prevIndex]);
    setSeek(0);
  };

  const handleEnd = () => {
    handleNext();
  };

  const handleLoad = () => {
    if (playerRef.current) {
      setDuration(playerRef.current.duration() as number);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    const newSeek = duration * percent;
    playerRef.current.seek(newSeek);
    setSeek(newSeek);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getTrackUrl = (track: Track) => {
    // Track files already use Discord proxy paths (/r2-audio/...)
    // No need to convert them - just return as-is for CSP compliance
    return track.file;
  };

  return (
    <>
      {/* Audio Player - ALWAYS rendered (even in PiP mode) */}
      {currentTrack && (
        <ReactHowler
          ref={playerRef}
          src={getTrackUrl(currentTrack)}
          playing={playing}
          volume={musicVolume / 100}
          onEnd={handleEnd}
          onLoad={handleLoad}
        />
      )}

      {/* UI Controls - HIDDEN in PiP mode */}
      {!isPIPMode && (
        <div className="fixed bottom-0 left-0 right-0">
          {/* Background layer - fades out on inactivity */}
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: isMouseActive || !autoHideUI ? 1 : 0 }}
            transition={{ duration: 0.5 }}
            style={{ willChange: 'opacity', transform: 'translateZ(0)' }}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl border-t border-white/10 pointer-events-none"
          />

          {/* Controls layer - always visible */}
          <div
            className={`relative max-w-7xl mx-auto ${isMobile ? 'px-2 py-2' : 'px-4 py-3'}`}
            style={{
              opacity: 1,
              pointerEvents: 'auto',
              transition: 'opacity 0.5s ease-in-out'
            }}
          >
            {/* Desktop: Spotify-style 3-column layout */}
            {!isMobile && (
              <div className="grid grid-cols-3 items-center gap-4">
                {/* Left: Track Info */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Genre Badge */}
                  <button
                    onClick={() => setPlaylist(playlist === 'lofi' ? 'synthwave' : 'lofi')}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white text-sm font-medium rounded-full transition-all duration-200 hover:border-white/30 flex-shrink-0"
                  >
                    {playlist === 'lofi' ? 'Lofi' : 'Synthwave'}
                  </button>

                  {currentTrack && (
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {currentTrack.title}
                      </p>
                      <p className="text-white text-xs truncate">{currentTrack.artist}</p>
                    </div>
                  )}
                </div>

                {/* Center: Controls + Progress */}
                <div className="flex flex-col items-center gap-1">
                  {/* Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevious}
                      className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                      <SkipBack size={20} />
                    </button>

                    <button
                      onClick={handlePlayPause}
                      className="p-3 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
                    >
                      {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                    </button>

                    <button
                      onClick={handleNext}
                      className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                      <SkipForward size={20} />
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-10 text-right">{formatTime(seek)}</span>
                    <div
                      className="flex-1 h-1 bg-gray-700 rounded-full cursor-pointer group"
                      onClick={handleSeek}
                    >
                      <div
                        className="h-full bg-white rounded-full transition-all group-hover:bg-purple-500"
                        style={{ width: `${duration ? (seek / duration) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Right: Volume & Background */}
                <div className="flex items-center justify-end gap-3">
                  {/* Inline Volume Slider */}
                  <div className="flex items-center gap-2">
                    <Volume2 size={18} className="text-gray-400" />
                    <div className="w-24 relative">
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all"
                          style={{ width: `${musicVolume}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={musicVolume}
                        onChange={(e) => setMusicVolume(Number(e.target.value))}
                        className="absolute inset-0 w-full h-1 appearance-none cursor-pointer bg-transparent
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-3
                      [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-white
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:shadow-md
                      [&::-moz-range-thumb]:w-3
                      [&::-moz-range-thumb]:h-3
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-white
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:shadow-md"
                      />
                    </div>
                  </div>

                  {/* Background Selector */}
                  <Popover open={showBackgrounds} onOpenChange={setShowBackgrounds}>
                    <PopoverTrigger asChild>
                      <button className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                        <ImageIcon size={20} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-80 p-0 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl"
                      align="end"
                      sideOffset={8}
                    >
                      <div className="p-4 border-b border-gray-700">
                        <h3 className="text-white font-bold text-sm">Select Background</h3>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-3 gap-2">
                          {filteredBackgrounds.map((bg) => (
                            <button
                              key={bg.id}
                              onClick={() => {
                                setBackground(bg.id);
                                setShowBackgrounds(false);
                              }}
                              className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-all ${background === bg.id
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
                                <span className="text-white text-xs font-medium">{bg.name}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Mobile layout */}
            {isMobile && (
              <div className="flex flex-col gap-2">
                {/* Mobile: Song Info at top */}
                {currentTrack && (
                  <div className="w-full text-center">
                    <p className="text-white text-sm font-semibold truncate">
                      {currentTrack.title}
                    </p>
                    <p className="text-white text-xs truncate mt-0.5">
                      {currentTrack.artist}
                    </p>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-2 justify-center w-full">
                  <button
                    onClick={handlePrevious}
                    className="p-3 text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <SkipBack size={20} />
                  </button>

                  <button
                    onClick={handlePlayPause}
                    className="p-3 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>

                  <button
                    onClick={handleNext}
                    className="p-3 text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <SkipForward size={20} />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-10 text-right">{formatTime(seek)}</span>
                  <div
                    className="flex-1 h-1 bg-gray-700 rounded-full cursor-pointer group"
                    onClick={handleSeek}
                  >
                    <div
                      className="h-full bg-white rounded-full transition-all group-hover:bg-purple-500"
                      style={{ width: `${duration ? (seek / duration) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
                </div>

                {/* Mobile: Genre Badge + Volume/Background on same row */}
                <div className="w-full flex items-center justify-between">
                  {/* Genre Badge */}
                  <button
                    onClick={() => setPlaylist(playlist === 'lofi' ? 'synthwave' : 'lofi')}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white text-xs font-medium rounded-full transition-all duration-200 hover:border-white/30"
                  >
                    {playlist === 'lofi' ? 'Lofi' : 'Synthwave'}
                  </button>

                  {/* Volume & Background */}
                  <div className="flex items-center gap-2">
                    {/* Volume Control */}
                    <div className="relative group">
                      <button
                        onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                      >
                        <Volume2 size={20} />
                      </button>

                      {/* Volume Slider Popup */}
                      {showVolumeSlider && (
                        <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-xl rounded-lg p-4 border border-white/10 w-48">
                          <div className="flex items-center gap-3">
                            <Volume2 size={16} className="text-gray-400" />
                            <div className="flex-1 relative">
                              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-white transition-all"
                                  style={{ width: `${musicVolume}%` }}
                                />
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={musicVolume}
                                onChange={(e) => setMusicVolume(Number(e.target.value))}
                                className="absolute inset-0 w-full h-2 appearance-none cursor-pointer bg-transparent
                              [&::-webkit-slider-thumb]:appearance-none
                              [&::-webkit-slider-thumb]:w-4
                              [&::-webkit-slider-thumb]:h-4
                              [&::-webkit-slider-thumb]:rounded-full
                              [&::-webkit-slider-thumb]:bg-white
                              [&::-webkit-slider-thumb]:cursor-pointer
                              [&::-webkit-slider-thumb]:shadow-md
                              [&::-moz-range-thumb]:w-4
                              [&::-moz-range-thumb]:h-4
                              [&::-moz-range-thumb]:rounded-full
                              [&::-moz-range-thumb]:bg-white
                              [&::-moz-range-thumb]:border-0
                              [&::-moz-range-thumb]:cursor-pointer
                              [&::-moz-range-thumb]:shadow-md"
                              />
                            </div>
                            <span className="text-xs text-white w-8 text-right">{musicVolume}%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Background Selector */}
                    <Popover open={showBackgrounds} onOpenChange={setShowBackgrounds}>
                      <PopoverTrigger asChild>
                        <button className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                          <ImageIcon size={20} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[calc(100vw-2rem)] max-w-sm p-0 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl"
                        align="end"
                        sideOffset={8}
                      >
                        <div className="p-4 border-b border-gray-700">
                          <h3 className="text-white font-bold text-sm">Select Background</h3>
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-2 gap-2">
                            {filteredBackgrounds.map((bg) => (
                              <button
                                key={bg.id}
                                onClick={() => {
                                  setBackground(bg.id);
                                  setShowBackgrounds(false);
                                }}
                                className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-all ${background === bg.id
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
                                  <span className="text-white text-xs font-medium">{bg.name}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
