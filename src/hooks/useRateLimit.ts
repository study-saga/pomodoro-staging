import { useState, useCallback, useRef, useEffect } from 'react';

interface RateLimitResult {
  canSend: boolean;
  timeUntilReset: number; // seconds
  messagesRemaining: number;
  recordMessage: () => void;
}

const MAX_MESSAGES = 10;
const TIME_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Enforces a rolling per-user message rate limit and exposes state and actions for UI control.
 *
 * The hook tracks message timestamps within the last TIME_WINDOW_MS and provides:
 * - whether a new message is allowed,
 * - seconds until the current rate-limit window resets,
 * - how many messages remain in the current window,
 * - a function to record a newly sent message.
 *
 * @returns An object with:
 *  - `canSend`: `true` if fewer than MAX_MESSAGES have been sent in the current window, `false` otherwise.
 *  - `timeUntilReset`: whole seconds until the oldest recorded message falls outside the time window (0 if none).
 *  - `messagesRemaining`: number of messages left before reaching MAX_MESSAGES (minimum 0).
 *  - `recordMessage`: function that records the current time as a sent message.
 */
export function useRateLimit(): RateLimitResult {
  const [messageTimestamps, setMessageTimestamps] = useState<number[]>([]);
  const [timeUntilReset, setTimeUntilReset] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up old timestamps outside the time window
  const cleanOldTimestamps = useCallback(() => {
    const now = Date.now();
    const cutoff = now - TIME_WINDOW_MS;
    setMessageTimestamps(prev => prev.filter(ts => ts > cutoff));
  }, []);

  // Update time until reset every second
  useEffect(() => {
    if (messageTimestamps.length > 0) {
      intervalRef.current = setInterval(() => {
        cleanOldTimestamps();

        const now = Date.now();
        const oldestTimestamp = messageTimestamps[0];
        if (oldestTimestamp) {
          const timeLeft = Math.ceil((oldestTimestamp + TIME_WINDOW_MS - now) / 1000);
          setTimeUntilReset(Math.max(0, timeLeft));
        } else {
          setTimeUntilReset(0);
        }
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      setTimeUntilReset(0);
    }
  }, [messageTimestamps, cleanOldTimestamps]);

  // Record a new message
  const recordMessage = useCallback(() => {
    const now = Date.now();
    setMessageTimestamps(prev => {
      const cutoff = now - TIME_WINDOW_MS;
      const filtered = prev.filter(ts => ts > cutoff);
      return [...filtered, now];
    });
  }, []);

  // Check if user can send a message
  const canSend = messageTimestamps.length < MAX_MESSAGES;
  const messagesRemaining = Math.max(0, MAX_MESSAGES - messageTimestamps.length);

  return {
    canSend,
    timeUntilReset,
    messagesRemaining,
    recordMessage
  };
}