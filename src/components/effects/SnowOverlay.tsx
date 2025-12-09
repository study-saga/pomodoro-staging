import ReactSnowfall from 'react-snowfall';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useDeviceType } from '../../hooks/useDeviceType';

export const SnowOverlay = () => {
    const { snowEnabled } = useSettingsStore();
    const { isMobile } = useDeviceType();

    if (!snowEnabled || isMobile) return null;

    return (
        <div
            style={{
                position: 'fixed',
                width: '100vw',
                height: '100vh',
                zIndex: 1, // Above background (-10) but behind Chat (40) and other controls
                pointerEvents: 'none', // Allow clicking through
            }}
        >
            <ReactSnowfall
                snowflakeCount={200}
                radius={[0.5, 3.0]}
                speed={[0.5, 3.0]}
                wind={[-0.5, 2.0]}
            />
        </div>
    );
};
