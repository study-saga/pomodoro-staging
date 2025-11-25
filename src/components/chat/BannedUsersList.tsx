import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useChat } from '../../contexts/ChatContext';
import { formatDistanceToNow } from 'date-fns';
import { Shield, Unlock, Clock, AlertTriangle } from 'lucide-react';

interface BannedUser {
    id: string;
    user_id: string;
    reason: string;
    expires_at: string | null;
    created_at: string;
    user: {
        username: string;
        avatar: string | null;
    };
    banner: {
        username: string;
    };
}

export function BannedUsersList() {
    const { unbanUser } = useChat();
    const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchBannedUsers = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('chat_bans')
            .select(`
        *,
        user:users!chat_bans_user_id_fkey(username, avatar),
        banner:users!chat_bans_banned_by_fkey(username)
      `)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setBannedUsers(data as any);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchBannedUsers();

        // Subscribe to changes
        const channel = supabase
            .channel('banned-users-list')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'chat_bans' },
                () => {
                    fetchBannedUsers();
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        );
    }

    if (bannedUsers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center p-4">
                <Shield size={48} className="mb-2 opacity-20" />
                <p>No active bans.</p>
                <p className="text-xs mt-1">The ban hammer is at rest.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 no-scrollbar">
            {bannedUsers.map((ban) => (
                <div key={ban.id} className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <img
                                src={ban.user.avatar || `https://ui-avatars.com/api/?name=${ban.user.username}&background=random`}
                                alt={ban.user.username}
                                className="w-10 h-10 rounded-full object-cover grayscale opacity-70"
                            />
                            <div>
                                <h3 className="font-bold text-gray-200 text-sm flex items-center gap-2">
                                    {ban.user.username}
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-medium uppercase tracking-wider">
                                        Banned
                                    </span>
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                    <AlertTriangle size={10} className="text-red-400" />
                                    {ban.reason}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => unbanUser(ban.user_id)}
                            className="p-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                            title="Unban User"
                        >
                            <Unlock size={16} />
                        </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
                        <div className="flex items-center gap-1">
                            <span>By @{ban.banner?.username || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock size={10} />
                            {ban.expires_at
                                ? `Expires ${formatDistanceToNow(new Date(ban.expires_at), { addSuffix: true })}`
                                : 'Permanent Ban'
                            }
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
