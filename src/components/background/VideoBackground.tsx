import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { BACKGROUNDS, getDefaultBackground } from '../../data/constants';
import { useDeviceType } from '../../hooks/useDeviceType';

export function VideoBackground() {
  const { background, setBackground } = useSettingsStore();
  const { isMobile, isPortrait } = useDeviceType();
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentBg = BACKGROUNDS.find((bg) => bg.id === background);

  // Validate background compatibility and fallback if needed
  useEffect(() => {
    if (currentBg) {
      const requiredOrientation = isPortrait ? 'vertical' : 'horizontal';
      if (currentBg.orientation !== requiredOrientation) {
        // Background doesn't match viewport orientation - switch to appropriate default
        const defaultBg = getDefaultBackground(isMobile);
        console.warn(`Background ${currentBg.name} (${currentBg.orientation}) incompatible with ${isPortrait ? 'portrait' : 'landscape'} orientation. Switching to default.`);
        setBackground(defaultBg);
      }
    }
  }, [currentBg, isMobile, isPortrait, setBackground]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((e) => console.log('Autoplay prevented:', e));
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
