import { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDeviceType } from '../../hooks/useDeviceType';

interface Track {
  id: string;
  title: string;
  artist: string;
  file: string;
  credits: string;
  genre: string;
}

interface MusicCreditsModalProps {
  tracks: Track[];
  onClose: () => void;
}

export function MusicCreditsModal({ tracks, onClose }: MusicCreditsModalProps) {
  const { isMobile } = useDeviceType();

  // Group tracks by genre
  const lofiTracks = tracks.filter(t => t.genre === 'lofi');
  const synthwaveTracks = tracks.filter(t => t.genre === 'synthwave');

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`relative bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 ${
            isMobile
              ? 'w-full h-full rounded-none'
              : 'w-[90vw] max-w-4xl h-[80vh] max-h-[800px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/20">
            <div>
              <h2 className={`font-bold text-white ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                Music Credits
              </h2>
              <p className={`text-gray-300 ${isMobile ? 'text-sm' : 'text-base'} mt-1`}>
                {tracks.length} royalty-free tracks
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto h-[calc(100%-100px)] p-6">
            {/* Lofi Section */}
            <div className="mb-8">
              <h3 className={`font-bold text-white mb-4 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                Lofi ({lofiTracks.length} tracks)
              </h3>
              <div
                className={`grid gap-3 ${
                  isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {lofiTracks.map((track) => (
                  <div
                    key={track.id}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                  >
                    <p className={`font-semibold text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
                      {track.title}
                    </p>
                    <p className={`text-gray-300 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {track.artist}
                    </p>
                    <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'} mt-1`}>
                      {track.credits}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Synthwave Section */}
            <div>
              <h3 className={`font-bold text-white mb-4 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                Synthwave ({synthwaveTracks.length} tracks)
              </h3>
              <div
                className={`grid gap-3 ${
                  isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {synthwaveTracks.map((track) => (
                  <div
                    key={track.id}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                  >
                    <p className={`font-semibold text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
                      {track.title}
                    </p>
                    <p className={`text-gray-300 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {track.artist}
                    </p>
                    <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'} mt-1`}>
                      {track.credits}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
