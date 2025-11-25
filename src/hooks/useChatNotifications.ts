import { useEffect, useState, useCallback } from 'react';
import { truncateMessage } from '../lib/chatService';

interface UseChatNotificationsResult {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  showNotification: (title: string, body: string, onClick?: () => void) => void;
}

/**
 * Manage browser notification permission and display chat message notifications.
 *
 * The hook initializes and exposes the current Notification.permission, a
 * function to request permission, and a function to show a chat notification
 * with a truncated body, app icon/badge, a duplicate-preventing tag, and an
 * automatic close after five seconds. If provided, the notification's click
 * handler will focus the window and invoke the supplied callback.
 *
 * @returns An object containing:
 * - `permission`: the current `NotificationPermission` value.
 * - `requestPermission`: a function that requests notification permission and updates `permission`.
 * - `showNotification`: a function `(title, body, onClick?)` that displays a truncated chat notification and optionally handles clicks.
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