import { memo } from 'react';
import { motion } from 'framer-motion';

interface MusicTabProps {
    setShowMusicCredits: (value: boolean) => void;
    totalTracks: number;
}

export const MusicTab = memo(({
    setShowMusicCredits,
    totalTracks,
}: MusicTabProps) => {
    return (
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
                <a
                    href="mailto:lexlarisa@protonmail.com?subject=Music%20Copyright%20Infringement%20Report"
                    className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
                >
                    Contact: lexlarisa@protonmail.com
                </a>
            </div>
        </motion.div>
    );
});
