import { useEffect, useState, useCallback } from 'react';
import { truncateMessage } from '../lib/chatService';

interface UseChatNotificationsResult {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  showNotification: (title: string, body: string, onClick?: () => void) => void;
}

/**
 * Hook for managing browser notifications for chat messages
 * Requests permission and shows notifications for new DMs
 */
export function useChatNotifications(): UseChatNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check current permission status
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, []);

  // Show a notification
  const showNotification = useCallback(
    (title: string, body: string, onClick?: () => void) => {
      if (permission !== 'granted') {
        console.log('Notification permission not granted');
        return;
      }

      if (!('Notification' in window)) {
        console.warn('Browser does not support notifications');
        return;
      }

      try {
        // Truncate body if too long
        const truncatedBody = truncateMessage(body, 100);

        const notification = new Notification(title, {
          body: truncatedBody,
          icon: '/icon.png', // App icon
          badge: '/icon.png',
          tag: 'chat-notification', // Prevent duplicate notifications
          requireInteraction: false,
          silent: false
        });

        // Handle notification click
        if (onClick) {
          notification.onclick = () => {
            window.focus();
            onClick();
            notification.close();
          };
        }

        // Auto-close after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    },
    [permission]
  );

  return {
    permission,
    requestPermission,
    showNotification
  };
}
