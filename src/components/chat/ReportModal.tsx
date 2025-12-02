import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onReport: (reason: string) => void;
    username: string;
}

export function ReportModal({ isOpen, onClose, onReport, username }: ReportModalProps) {
    const [reason, setReason] = useState('');
    const [customReason, setCustomReason] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalReason = reason === 'Other' ? customReason : reason;
        if (finalReason.trim()) {
            onReport(finalReason);
            onClose();
            setReason('');
            setCustomReason('');
        }
    };

    const reasons = [
        'Spam or advertising',
        'Harassment or bullying',
        'Hate speech',
        'Inappropriate content',
        'Other'
    ];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle size={20} />
                        <h3 className="font-bold">Report Message</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-gray-300">
                        Why are you reporting this message from <span className="font-bold text-white">@{username}</span>?
                    </p>

                    <div className="space-y-2">
                        {reasons.map((r) => (
                            <label
                                key={r}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${reason === r
                                        ? 'bg-red-500/10 border-red-500/50 text-white'
                                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="reason"
                                    value={r}
                                    checked={reason === r}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-4 h-4 text-red-500 border-gray-600 focus:ring-red-500 bg-gray-700"
                                />
                                <span className="text-sm font-medium">{r}</span>
                            </label>
                        ))}
                    </div>

                    {reason === 'Other' && (
                        <textarea
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            placeholder="Please provide more details..."
                            className="w-full h-24 bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition-colors resize-none"
                            required
                        />
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!reason || (reason === 'Other' && !customReason.trim())}
                            className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg shadow-red-500/20"
                        >
                            Submit Report
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
