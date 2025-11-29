import { memo } from 'react';
import { motion } from 'framer-motion';
import { AMBIENT_SOUNDS } from '../../../data/constants';

interface SoundsTabProps {
    tempVolume: number;
    setTempVolume: (value: number) => void;
    tempMusicVolume: number;
    setTempMusicVolume: (value: number) => void;
    tempAmbientVolumes: Record<string, number>;
    setTempAmbientVolumes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    tempPlaylist: 'lofi' | 'synthwave';
    setTempPlaylist: (playlist: 'lofi' | 'synthwave') => void;
    isMobile: boolean;
}

export const SoundsTab = memo(({
    tempVolume,
    setTempVolume,
    tempMusicVolume,
    setTempMusicVolume,
    tempAmbientVolumes,
    setTempAmbientVolumes,
    tempPlaylist,
    setTempPlaylist,
    isMobile,
}: SoundsTabProps) => {
    return (
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

                <div className="mb-6">
                    <label className="text-white text-sm mb-2 block">🎵 Playlist Selection</label>
                    <div className="bg-gray-800 p-1 rounded-lg flex">
                        <button
                            onClick={() => setTempPlaylist('lofi')}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${tempPlaylist === 'lofi'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            Lofi Beats
                        </button>
                        <button
                            onClick={() => setTempPlaylist('synthwave')}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${tempPlaylist === 'synthwave'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            Synthwave
                        </button>
                    </div>
                </div>

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
    );
});
