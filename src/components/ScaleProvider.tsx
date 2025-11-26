import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface ScaleContextType {
    scale: number;
}

const ScaleContext = createContext<ScaleContextType | undefined>(undefined);

export const useScale = (): ScaleContextType => {
    const context = useContext(ScaleContext);
    if (!context) {
        throw new Error('useScale must be used within a ScaleProvider');
    }
    return context;
};

interface ScaleProviderProps {
    baseWidth: number;
    baseHeight: number;
    children: ReactNode | ReactNode[];
}

export const ScaleProvider = (props: ScaleProviderProps) => {
    const { baseWidth, baseHeight, children } = props;
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            // Calculate scale to ensure logical viewport is AT LEAST baseWidth x baseHeight
            // This is the "Expand" strategy (similar to Aspect Ratio Fitting in game engines)
            const scaleX = window.innerWidth / baseWidth;
            const scaleY = window.innerHeight / baseHeight;
            const newScale = Math.min(scaleX, scaleY);

            setScale(newScale);
        };

        // Initial calculation
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [baseWidth, baseHeight]);

    // Calculate logical dimensions based on current window size and scale
    // This ensures the container fills the screen exactly
    const logicalWidth = typeof window !== 'undefined' ? window.innerWidth / scale : baseWidth;
    const logicalHeight = typeof window !== 'undefined' ? window.innerHeight / scale : baseHeight;

    return (
        <ScaleContext.Provider value={{ scale }}>
            <div
                style={{
                    width: '100vw',
                    height: '100vh',
                    overflow: 'hidden',
                    backgroundColor: '#000',
                }}
            >
                <div
                    id="scaled-content"
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        width: `${logicalWidth}px`,
                        height: `${logicalHeight}px`,
                        position: 'relative',
                    }}
                >
                    {children}
                </div>
            </div>
        </ScaleContext.Provider>
    );
};
