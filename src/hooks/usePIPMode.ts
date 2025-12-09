import { useState, useEffect } from 'react';

/**
 * Hook to detect when the Activity is in Picture-in-Picture mode (minimized)
 * Returns true when viewport width is less than 600px
 */
export function usePIPMode(threshold = 600) {
    const [viewportWidth, setViewportWidth] = useState(
        typeof window !== 'undefined' ? window.innerWidth : 1920
    );

    useEffect(() => {
        const updateViewportWidth = () => {
            setViewportWidth(window.innerWidth);
        };

        updateViewportWidth();
        window.addEventListener('resize', updateViewportWidth);
        return () => window.removeEventListener('resize', updateViewportWidth);
    }, []);

    return viewportWidth < threshold;
}
