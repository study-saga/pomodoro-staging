import { useRef, useEffect, memo } from 'react';
import { Howl } from 'howler';
import { AMBIENT_SOUNDS } from '../../data/constants';
import { useSettingsStore } from '../../store/useSettingsStore';

interface AmbientSoundsPlayerProps {
  musicPlaying: boolean;
}

export const AmbientSoundsPlayer = memo(function AmbientSoundsPlayer({ musicPlaying }: AmbientSoundsPlayerProps) {
  const ambientVolumes = useSettingsStore((state) => state.ambientVolumes);
  const howlInstancesRef = useRef<Record<string, Howl>>({});

  // Load sound only when needed (lazy loading)
  const getOrCreateHowl = (soundId: string, file: string): Howl => {
    if (!howlInstancesRef.current[soundId]) {
      console.log(`[Ambient] Lazy loading sound: ${soundId}`);

      howlInstancesRef.current[soundId] = new Howl({
        src: [file],
        loop: true,
        html5: true,
        preload: true,  // Load now that we need it
        onload: () => console.log(`[Ambient] Loaded: ${soundId}`),
        onloaderror: (_id, err) => console.error(`[Ambient] Failed to load ${soundId}:`, err)
      });
    }

    return howlInstancesRef.current[soundId];
  };

  // Update playback when volumes or musicPlaying changes
  useEffect(() => {
    AMBIENT_SOUNDS.forEach(sound => {
      const volume = ambientVolumes[sound.id] || 0;

      if (volume > 0) {
        // User wants this sound - load it if needed
        const howl = getOrCreateHowl(sound.id, sound.file);
        howl.volume(volume / 100);

        if (musicPlaying) {
          if (!howl.playing()) howl.play();
        } else {
          howl.pause();
        }
      } else {
        // Volume is 0 - stop if playing, but keep loaded
        const howl = howlInstancesRef.current[sound.id];
        if (howl?.playing()) {
          howl.pause();
        }
      }
    });
  }, [ambientVolumes, musicPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(howlInstancesRef.current).forEach(howl => {
        howl.unload();
      });
    };
  }, []);

  return null;
});
