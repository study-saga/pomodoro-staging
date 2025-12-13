import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface SystemNotification {
  id: string;
  message: string;
  notification_type: 'info' | 'warning' | 'error' | 'success';
  created_at: string;
  expires_at: string | null;
  priority: number;
  action_label: string | null;
  action_url: string | null;
}

const DISMISSED_KEY = 'dismissed_system_notifications';

/**
 * Hook to subscribe to admin-triggered system notifications via Realtime
 *
 * Features:
 * - Fetches active notifications on mount
 * - Subscribes to realtime INSERT/UPDATE events
 * - Shows persistent toasts (infinite duration)
 * - Tracks dismissed notifications in localStorage
 * - Supports action buttons (e.g., "Refresh Now")
 * - Special "REFRESH" action URL to reload the page
 */
export function useSystemNotifications() {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist dismissed IDs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedIds]));
  }, [dismissedIds]);

  const showNotification = useCallback((notification: SystemNotification) => {
    // Skip if already dismissed
    if (dismissedIds.has(notification.id)) return;

    // Select the appropriate toast function based on type
    const toastFn = {
      info: toast.info,
      warning: toast.warning,
      error: toast.error,
      success: toast.success,
    }[notification.notification_type] || toast;

    toastFn(notification.message, {
      duration: Infinity, // Don't auto-dismiss - user must manually dismiss
      description: notification.action_label || undefined,
      action: notification.action_url ? {
        label: notification.action_label || 'Click here',
        onClick: () => {
          if (notification.action_url === 'REFRESH') {
            // Special case: refresh the entire page
            window.location.reload();
          } else {
            // Open external URL in new tab
            window.open(notification.action_url, '_blank');
          }
        }
      } : undefined,
      onDismiss: () => {
        // Track dismissal so we don't show again
        setDismissedIds(prev => new Set([...prev, notification.id]));
      },
    });
  }, [dismissedIds]);

  // Fetch active notifications on mount
  useEffect(() => {
    const fetchActiveNotifications = async () => {
      const { data, error } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SystemNotifications] Failed to fetch:', error);
        return;
      }

      // Show all active notifications
      data?.forEach(notification => {
        showNotification(notification as SystemNotification);
      });
    };

    fetchActiveNotifications();
  }, [showNotification]);

  // Subscribe to realtime notifications
  useEffect(() => {
    const notificationsChannel = supabase
      .channel('system-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_notifications',
        },
        (payload) => {
          const notification = payload.new as SystemNotification;

          // Only show if active and not expired
          if (notification.is_active) {
            const isExpired = notification.expires_at
              && new Date(notification.expires_at) < new Date();

            if (!isExpired) {
              showNotification(notification);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_notifications',
        },
        (payload) => {
          const notification = payload.new as SystemNotification;

          // If notification was deactivated, dismiss existing toast
          if (!notification.is_active) {
            toast.dismiss(notification.id);
            setDismissedIds(prev => new Set([...prev, notification.id]));
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('[SystemNotifications] Subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('[SystemNotifications] Connected to realtime channel');
        }
      });

    setChannel(notificationsChannel);

    return () => {
      notificationsChannel.unsubscribe();
    };
  }, [showNotification]);

  return { channel };
}
