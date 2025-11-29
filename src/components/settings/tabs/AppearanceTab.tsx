import { memo } from 'react';
import { motion } from 'framer-motion';

interface AppearanceTabProps {
    filteredBackgrounds: Array<{
        id: string;
        name: string;
        poster: string;
        orientation: 'vertical' | 'horizontal';
    }>;
    tempBackground: string;
    setTempBackground: (value: string) => void;
}

export const AppearanceTab = memo(({
    filteredBackgrounds,
    tempBackground,
    setTempBackground,
}: AppearanceTabProps) => {
    return (
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
    );
});
