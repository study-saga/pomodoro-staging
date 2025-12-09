import ReactSnowfall from 'react-snowfall';

export const SnowOverlay = () => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 1 // Above background (-10) but behind Chat (40) and other controls
        }}>
            <ReactSnowfall
                snowflakeCount={150}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                }}
            />
        </div>
    );
};
