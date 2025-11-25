import { useState } from 'react';
import { X, AlertTriangle, Clock } from 'lucide-react';

interface BanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBan: (duration: number | null, reason: string) => void;
    username: string;
}

const BAN_DURATIONS = [
    { label: '1 Hour', value: 60 },
    { label: '6 Hours', value: 360 },
    { label: '24 Hours', value: 1440 },
    { label: '7 Days', value: 10080 },
    { label: 'Permanent', value: null },
];

/**
 * Render a confirmation modal that allows selecting a ban duration and providing a reason to ban a user.
 *
 * The modal only renders when `isOpen` is true. The "Ban User" action is disabled until a non-empty reason
 * is provided; invoking it calls `onBan(selectedDuration, reason)` and then `onClose()`.
 *
 * @param isOpen - Controls whether the modal is visible
 * @param onClose - Callback invoked to close the modal
 * @param onBan - Callback invoked to perform the ban with signature `(duration: number | null, reason: string)`
 * @param username - The username of the target user shown in the modal header
 * @returns The modal element when open, or `null` when closed
 */
export function BanModal({ isOpen, onClose, onBan, username }: BanModalProps) {
    const [reason, setReason] = useState('');
    const [selectedDuration, setSelectedDuration] = useState<number | null>(60);

    if (!isOpen) return null;

    const handleBan = () => {
        if (!reason.trim()) return;
        onBan(selectedDuration, reason);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <AlertTriangle className="text-red-500" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Ban User</h2>
                            <p className="text-sm text-gray-400">Banning <span className="text-white font-medium">@{username}</span></p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Duration Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <Clock size={14} />
                            Duration
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {BAN_DURATIONS.map((duration) => (
                                <button
                                    key={duration.label}
                                    onClick={() => setSelectedDuration(duration.value)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedDuration === duration.value
                                        ? 'bg-red-500 text-white'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {duration.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reason Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Reason
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Why is this user being banned?"
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:border-red-500/50 focus:outline-none resize-none h-24 text-sm"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleBan}
                            disabled={!reason.trim()}
                            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-900/20"
                        >
                            Ban User
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}