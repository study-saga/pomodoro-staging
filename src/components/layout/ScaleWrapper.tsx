import type { ReactNode } from 'react';
import { useScaleFactor } from '../../hooks/useScaleFactor';

interface ScaleWrapperProps {
    children: ReactNode;
}

export function ScaleWrapper({ children }: ScaleWrapperProps) {
    const scale = useScaleFactor();

    // If scale is 1, render normally to avoid any transform side-effects (like fuzzy text or portal issues)
    // Although 0.999... might happen, let's strictly check for 1 or close to 1.
    if (Math.abs(scale - 1) < 0.01) {
        return <>{children}</>;
    }

    // Calculate the compensated dimensions
    // transform: scale(0.5) makes a 1000px element look 500px wide.
    // So if our window is 500px, and we want to show 1000px worth of content scaled down,
    // we need the internal container to be 1000px (which is window / scale).
    const width = `${100 / scale}vw`;
    const height = `${100 / scale}vh`;

    return (
        <div
            style={{
                width,
                height,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                // Ensure overflow is hidden on the wrapper if we want to prevent scrollbars from the larger internal size
                // But usually, the "App" handles overflow.
            }}
            className="overflow-hidden"
        >
            {children}
        </div>
    );
}
