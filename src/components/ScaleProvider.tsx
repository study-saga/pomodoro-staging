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
            const scaleWidth = window.innerWidth / baseWidth;
            const scaleHeight = window.innerHeight / baseHeight;
            setScale(Math.min(scaleWidth, scaleHeight));
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [baseWidth, baseHeight]);

    return (
        <ScaleContext.Provider value={{ scale }}>
            <div
                id=" scaled-root"
                style={{
                    width: '100vw',
                    height: '100vh',
                    overflow: 'hidden',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        width: `${baseWidth}px`,
                        height: `${baseHeight}px`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                    }}
                >
                    {children}
                </div>
            </div>
        </ScaleContext.Provider>
    );
};
