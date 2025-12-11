import { useState, useEffect } from 'react';
import { useDeviceType } from './useDeviceType';

// The "ideal" desktop design width.
// If the window is narrower than this on Desktop, we scale down to fit.
const TARGET_DESKTOP_WIDTH = 1280;
const MIN_SCALE = 0.5;

export function useScaleFactor() {
    const { isMobile, isTablet } = useDeviceType();
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const calculateScale = () => {
            // Mobile/Tablet: specific responsive CSS should handle layout, no scaling transform needed.
            if (isMobile || isTablet) {
                setScale(1);
                return;
            }

            // Desktop: "Smart Scaling"
            // If window.innerWidth is less than TARGET, we scale down.
            // If window.innerWidth is larger, we stick to 1 (or we could scale up, but usually 1 is fine).
            const newScale = Math.min(window.innerWidth / TARGET_DESKTOP_WIDTH, 1);

            // Prevent it from getting too small
            setScale(Math.max(newScale, MIN_SCALE));
        };

        calculateScale();
        window.addEventListener('resize', calculateScale);

        return () => window.removeEventListener('resize', calculateScale);
    }, [isMobile, isTablet]);

    return scale;
}
