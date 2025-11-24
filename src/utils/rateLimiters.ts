/**
 * Rate Limiting Utilities
 * 
 * Provides reusable rate limiting functions to prevent database spam
 * and improve user experience by preventing rapid duplicate operations.
 */

/**
 * Creates a throttled version of a function that ignores calls
 * within the specified delay window.
 * 
 * @param delayMs - Minimum milliseconds between function calls
 * @returns Wrapped function that enforces rate limit
 * 
 * @example
 * const throttled = createRateLimiter(1000)(handleClick);
 * throttled(); // executes
 * throttled(); // ignored (< 1000ms)
 */
export function createRateLimiter(delayMs: number) {
    let lastCall = 0;

    return <T extends (...args: any[]) => void>(fn: T): T => {
        return ((...args: any[]) => {
            const now = Date.now();

            // Ignore if called within delay window
            if (now - lastCall < delayMs) {
                console.log(`[Rate Limiter] Ignoring rapid call (${now - lastCall}ms since last call, need ${delayMs}ms)`);
                return;
            }

            lastCall = now;
            fn(...args);
        }) as T;
    };
}

/**
 * Creates a rate-limited async function that prevents overlapping executions
 * and enforces a minimum delay between calls.
 * 
 * @param delayMs - Minimum milliseconds between function calls
 * @returns Wrapped async function with rate limiting and execution guard
 * 
 * @example
 * const rateLimited = createAsyncRateLimiter(1000)(async () => {
 *   await saveToDatabase();
 * });
 */
export function createAsyncRateLimiter(delayMs: number) {
    let lastCall = 0;
    let isExecuting = false;

    return <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
        return (async (...args: any[]) => {
            const now = Date.now();

            // Prevent overlapping executions
            if (isExecuting) {
                console.log('[Async Rate Limiter] Already executing, ignoring call');
                return;
            }

            // Enforce minimum delay between calls
            if (now - lastCall < delayMs) {
                console.log(`[Async Rate Limiter] Too soon (${now - lastCall}ms since last call, need ${delayMs}ms)`);
                return;
            }

            isExecuting = true;
            lastCall = now;

            try {
                return await fn(...args);
            } finally {
                isExecuting = false;
            }
        }) as T;
    };
}

/**
 * Toast notification deduplication cache
 * Prevents showing the same toast message multiple times within timeout window
 */
const toastCache = new Map<string, number>();
const DEFAULT_TOAST_DURATION = 4000; // Match typical toast duration

/**
 * Rate-limited toast notification setter that prevents duplicate messages
 * from appearing within the toast duration window.
 * 
 * @param message - Toast message to display
 * @param setState - State setter function for toast message
 * @param durationMs - Toast duration in milliseconds (default: 4000)
 * 
 * @example
 * rateLimitedToast(
 *   "Settings saved!",
 *   setToastMessage,
 *   4000
 * );
 */
export function rateLimitedToast(
    message: string,
    setState: (msg: string | null) => void,
    durationMs: number = DEFAULT_TOAST_DURATION
) {
    const lastShown = toastCache.get(message) || 0;
    const now = Date.now();

    // Don't show same message within duration window
    if (now - lastShown < durationMs) {
        console.log(`[Toast Rate Limiter] Suppressing duplicate: "${message.substring(0, 50)}..." (shown ${now - lastShown}ms ago)`);
        return;
    }

    toastCache.set(message, now);
    setState(message);

    // Cleanup cache after toast dismisses to prevent memory leak
    setTimeout(() => {
        toastCache.delete(message);
    }, durationMs + 1000);
}

/**
 * Clear all cached toast messages (useful for testing or resetting state)
 */
export function clearToastCache() {
    toastCache.clear();
}

/**
 * Creates a debounced version of a function that delays execution
 * until after the specified delay has elapsed since the last call.
 * 
 * @param delayMs - Milliseconds to wait before executing
 * @returns Wrapped function that debounces calls
 * 
 * @example
 * const debounced = createDebouncer(500)(handleInput);
 * debounced(); // waits 500ms
 * debounced(); // resets timer, waits another 500ms
 */
export function createDebouncer(delayMs: number) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return <T extends (...args: any[]) => void>(fn: T): T => {
        return ((...args: any[]) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                fn(...args);
                timeoutId = null;
            }, delayMs);
        }) as T;
    };
}
