import { memo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
    ROLE_EMOJI_ELF,
    ROLE_EMOJI_HUMAN,
    getBadgeForLevel,
} from '../../../data/levels';

interface ProgressTabProps {
    levelPath: 'elf' | 'human';
    handleRoleChange: (newRole: 'elf' | 'human') => void;
    level: number;
    levelNameLabel: string;
    xp: number;
    prestigeLevel: number;
    totalPomodoros: number;
    totalStudyMinutes: number;
    usernameInput: string;
    setUsernameInput: (value: string) => void;
    handleSaveUsername: () => void;
    usernameError: string | null;
    setUsernameError: (value: string | null) => void;
    usernameLoading: boolean;
    resetProgress: () => void;
}

export const ProgressTab = memo(({
    levelPath,
    handleRoleChange,
    level,
    levelNameLabel,
    xp,
    prestigeLevel,
    totalPomodoros,
    totalStudyMinutes,
    usernameInput,
    setUsernameInput,
    handleSaveUsername,
    usernameError,
    setUsernameError,
    usernameLoading,
    resetProgress,
}: ProgressTabProps) => {
    return (
        <motion.div
            key="progress"
            role="tabpanel"
            id="progress-panel"
            aria-labelledby="progress-tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
        >
            <div>
                <h3 className="text-white font-bold text-lg mb-4">Hero Progress</h3>

                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded-lg p-3 relative overflow-hidden">
                        <div className="flex items-start justify-between mb-1">
                            <p className="text-gray-400 text-xs">CURRENT LEVEL</p>
                            {/* Role Toggle Switch */}
                            <label className="relative inline-block w-14 h-7 cursor-pointer shrink-0 ml-2">
                                <input
                                    type="checkbox"
                                    className="opacity-0 w-0 h-0 peer"
                                    checked={levelPath === 'human'}
                                    onChange={(e) => handleRoleChange(e.target.checked ? 'human' : 'elf')}
                                />
                                <span className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full transition-all duration-300 shadow-lg peer-checked:from-blue-600 peer-checked:to-blue-700"></span>
                                <span className="absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full transition-all duration-300 flex items-center justify-center text-sm shadow-md peer-checked:translate-x-[28px]">
                                    {levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN}
                                </span>
                            </label>
                        </div>
                        <p
                            className="text-white font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full"
                            style={{
                                fontSize: levelNameLabel.length > 18 ? '0.85rem' : levelNameLabel.length > 14 ? '0.95rem' : levelNameLabel.length > 11 ? '1.1rem' : '1.25rem'
                            }}
                        >
                            {level} - {levelNameLabel}
                        </p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">CURRENT XP</p>
                        <p className="text-white text-xl font-bold">{xp} / {level * 100}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">PRESTIGE LEVEL</p>
                        <p className="text-white text-xl font-bold">{prestigeLevel}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">TOTAL POMODOROS</p>
                        <p className="text-white text-xl font-bold">{totalPomodoros}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 col-span-2">
                        <p className="text-gray-400 text-xs mb-1">TOTAL STUDY TIME</p>
                        <p className="text-white text-xl font-bold">
                            {Math.floor(totalStudyMinutes / 60)}h {totalStudyMinutes % 60}m
                        </p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 col-span-2">
                        <p className="text-gray-400 text-xs mb-1">CURRENT BADGE</p>
                        <p className="text-5xl">{getBadgeForLevel(level, prestigeLevel)}</p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-white font-bold text-lg mb-2">Username</h3>
                <p className="text-gray-400 text-sm mb-3">
                    Change your display name. Free once per week, or costs 50 XP if changed earlier.
                </p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => {
                            setUsernameInput(e.target.value.slice(0, 20));
                            setUsernameError(null);
                        }}
                        maxLength={20}
                        disabled={usernameLoading}
                        className="flex-1 bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="User"
                    />
                    <button
                        onClick={handleSaveUsername}
                        disabled={usernameLoading}
                        className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {usernameLoading ? 'Saving...' : 'Save Username'}
                    </button>
                </div>
                {usernameError && (
                    <p className="text-red-400 text-sm mt-2">
                        ⚠ {usernameError}
                    </p>
                )}
            </div>

            <div>
                <h3 className="text-white font-bold text-lg mb-4">Reset Progress</h3>
                <p className="text-gray-400 text-sm mb-3">
                    This will reset all your progress including level, XP, prestige, and stats.
                    This action cannot be undone.
                </p>
                <button
                    onClick={() => {
                        toast('Reset All Progress?', {
                            description: 'This action cannot be undone. All your XP, levels, prestige, and stats will be lost permanently.',
                            duration: 10000,
                            action: {
                                label: 'Reset Everything',
                                onClick: async () => {
                                    try {
                                        // Reset local state
                                        resetProgress();

                                        toast.success('All progress has been reset');
                                    } catch (error) {
                                        console.error('Failed to reset progress:', error);
                                        toast.error('Failed to reset progress in database');
                                    }
                                }
                            },
                            cancel: {
                                label: 'Cancel',
                                onClick: () => { }
                            }
                        });
                    }}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                >
                    Reset All Progress
                </button>
            </div>
        </motion.div>
    );
});
