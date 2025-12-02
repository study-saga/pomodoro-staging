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
 * Rate limiting hook to prevent spam
 * Limits users to MAX_MESSAGES messages per TIME_WINDOW_MS
 */
export function useRateLimit(): RateLimitResult {
  const [messageTimestamps, setMessageTimestamps] = useState<number[]>([]);
  const messageTimestampsRef = useRef<number[]>([]);

  // Keep ref in sync
  useEffect(() => {
    messageTimestampsRef.current = messageTimestamps;
  }, [messageTimestamps]);

  const [timeUntilReset, setTimeUntilReset] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up old timestamps outside the time window
  const cleanOldTimestamps = useCallback(() => {
    const now = Date.now();
    const cutoff = now - TIME_WINDOW_MS;

    // Use functional update to avoid dependency on state
    setMessageTimestamps(prev => prev.filter(ts => ts > cutoff));
  }, []);

  // Update time until reset every second
  useEffect(() => {
    // Start interval once
    intervalRef.current = setInterval(() => {
      // We can call cleanOldTimestamps here, but better to just read ref for calculation
      // to avoid state updates if not needed.
      // However, the original code called cleanOldTimestamps() every second.
      // Let's replicate that behavior but safely.
      cleanOldTimestamps();

      const now = Date.now();
      // Read from ref to get latest without restarting interval
      const currentTimestamps = messageTimestampsRef.current;

      if (currentTimestamps.length > 0) {
        const oldestTimestamp = currentTimestamps[0];
        // Check if oldest is actually valid (might have been cleaned but ref update pending?)
        // The cleanOldTimestamps queues a state update, which updates ref in effect.
        // So ref might be slightly stale in this tick, but that's fine for UI timer.

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
  }, [cleanOldTimestamps]); // cleanOldTimestamps is stable via useCallback

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
