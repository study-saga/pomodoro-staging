import { useEffect, useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { Shield, AlertTriangle, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

export function AdminActionHandler() {
    const { banUser, userRole } = useChat();

    const [showConfirm, setShowConfirm] = useState(false);
    const [actionDetails, setActionDetails] = useState<{
        type: 'ban';
        userId: string;
        username: string;
        duration: string;
    } | null>(null);

    useEffect(() => {
        // Parse URL params manually since we don't have react-router
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');

        if (action === 'ban') {
            const userId = params.get('userId');
            const username = params.get('username');
            const duration = params.get('duration');

            if (userId && username && duration) {
                // Verify permissions
                if (userRole !== 'admin' && userRole !== 'moderator') {
                    toast.error('You do not have permission to perform this action.');
                    // Clear params
                    window.history.replaceState({}, '', window.location.pathname);
                    return;
                }

                setActionDetails({
                    type: 'ban',
                    userId,
                    username,
                    duration
                });
                setShowConfirm(true);
            }
        }
    }, [userRole]);

    const handleConfirm = async () => {
        if (!actionDetails) return;

        if (actionDetails.type === 'ban') {
            try {
                let durationMinutes: number | null = null;

                if (actionDetails.duration === '24h') durationMinutes = 24 * 60;
                else if (actionDetails.duration === '168h') durationMinutes = 7 * 24 * 60;
                else if (actionDetails.duration === 'permanent') durationMinutes = null;

                await banUser(actionDetails.userId, durationMinutes, `Quick ban via Discord (${actionDetails.duration})`);
                toast.success(`Banned @${actionDetails.username} successfully.`);
            } catch (error) {
                console.error('Failed to ban user:', error);
                toast.error('Failed to ban user.');
            }
        }

        handleClose();
    };

    const handleClose = () => {
        setShowConfirm(false);
        setActionDetails(null);
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
    };

    if (!showConfirm || !actionDetails) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-gray-900 border border-red-500/30 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-red-500/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <Shield className="w-5 h-5 text-red-400" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Confirm Quick Ban</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/10 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm text-red-200">
                                Are you sure you want to ban <span className="font-bold text-white">@{actionDetails.username}</span>?
                            </p>
                            <p className="text-xs text-red-300/60">
                                Duration: <span className="font-mono text-red-300">{actionDetails.duration === 'permanent' ? 'Permanent' : actionDetails.duration}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex justify-end gap-3">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-lg shadow-red-500/20 transition-all active:scale-95"
                    >
                        Confirm Ban
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
