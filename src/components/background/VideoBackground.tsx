import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { BACKGROUNDS, getDefaultBackground } from '../../data/constants';
import { useDeviceType } from '../../hooks/useDeviceType';

export function VideoBackground() {
  const { background, setBackground } = useSettingsStore();
  const { isMobile, isPortrait } = useDeviceType();
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentBg = BACKGROUNDS.find((bg) => bg.id === background);

  // Handle device type changes (resize)
  useEffect(() => {
    const { backgroundMobile, backgroundDesktop, setBackground } = useSettingsStore.getState();

    // Determine which background we SHOULD be showing
    const targetBackground = isMobile ? backgroundMobile : backgroundDesktop;

    // If current background doesn't match target (and target exists), switch it
    if (targetBackground && background !== targetBackground) {
      import.meta.env.DEV && console.log(`[VideoBackground] Switching to ${isMobile ? 'mobile' : 'desktop'} preference: ${targetBackground}`);
      setBackground(targetBackground);
      return;
    }

    // Fallback: Validate current background compatibility
    if (currentBg) {
      const requiredOrientation = isPortrait ? 'vertical' : 'horizontal';
      if (currentBg.orientation !== requiredOrientation) {
        // Background doesn't match viewport orientation - switch to appropriate default
        // This handles cases where preference might be invalid for current orientation
        const defaultBg = getDefaultBackground(isMobile);
        console.warn(`Background ${currentBg.name} (${currentBg.orientation}) incompatible with ${isPortrait ? 'portrait' : 'landscape'} orientation. Switching to default.`);
        setBackground(defaultBg);
      }
    }
  }, [isMobile, isPortrait, background, currentBg, setBackground]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((e) => import.meta.env.DEV && console.log('Autoplay prevented:', e));
    }
  }, [background]);

  if (!currentBg) return null;

  return (
    <>
      <video
        ref={videoRef}
        key={background}
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 w-full h-full object-cover -z-10"
        src={currentBg.file}
      />
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/30 -z-10" />
    </>
  );
}
