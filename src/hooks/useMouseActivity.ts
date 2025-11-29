import { useState, useEffect } from 'react';

// Global state shared across all components
let globalIsActive = true;
let globalTimeoutRef: ReturnType<typeof setTimeout> | null = null;
let currentTimeoutMs = 2000; // Default (2 seconds)
const subscribers = new Set<(isActive: boolean) => void>();

// Global activity handler
const resetGlobalTimeout = () => {
  // Show UI globally
  if (!globalIsActive) {
    globalIsActive = true;
    subscribers.forEach(callback => callback(true));
  }

  // Clear existing timeout
  if (globalTimeoutRef) {
    clearTimeout(globalTimeoutRef);
  }

  // Set new timeout to hide UI globally
  globalTimeoutRef = setTimeout(() => {
    globalIsActive = false;
    subscribers.forEach(callback => callback(false));
  }, currentTimeoutMs);
};

// Throttle helper
const throttle = (fn: Function, ms: number) => {
  let lastTime = 0;
  return (...args: any[]) => {
    const now = Date.now();
    if (now - lastTime >= ms) {
      lastTime = now;
      fn(...args);
    }
  };
};

// Initialize global listeners once
let listenersInitialized = false;
const initializeGlobalListeners = () => {
  if (listenersInitialized) return;
  listenersInitialized = true;

  const handleActivity = throttle(() => resetGlobalTimeout(), 60);

  // Initial timeout
  resetGlobalTimeout();

  // Event listeners with passive for better performance
  window.addEventListener('mousemove', handleActivity, { passive: true });
  window.addEventListener('mousedown', handleActivity, { passive: true });
  window.addEventListener('click', handleActivity, { passive: true });
  window.addEventListener('keydown', handleActivity, { passive: true });
  window.addEventListener('touchstart', handleActivity, { passive: true });
  window.addEventListener('touchmove', handleActivity, { passive: true });
  window.addEventListener('wheel', handleActivity, { passive: true });
};

/**
 * Hook to detect mouse inactivity
 * Hides UI after specified timeout, shows on mouse move/click
 * All components share the same timer - they hide/show together
 */
export const useMouseActivity = (timeoutMs: number = 2000) => {
  const [isActive, setIsActive] = useState(globalIsActive);

  useEffect(() => {
    // Update global timeout if changed
    if (timeoutMs !== currentTimeoutMs) {
      currentTimeoutMs = timeoutMs;
      resetGlobalTimeout();
    }

    // Initialize global listeners (only happens once)
    initializeGlobalListeners();

    // Subscribe to global state changes
    subscribers.add(setIsActive);

    // Sync with current global state
    setIsActive(globalIsActive);

    return () => {
      subscribers.delete(setIsActive);
    };
  }, [timeoutMs]);

  return isActive;
};
