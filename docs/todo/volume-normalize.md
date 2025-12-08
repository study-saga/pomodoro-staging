# Audio Volume Normalization Implementation Plan

## Problem
Different music tracks have inconsistent volume levels. Users want normalized volume across all tracks without pre-processing audio files.

## Solution
Add Web Audio API DynamicsCompressorNode to music player for real-time transparent compression.

## User Requirements
- ✅ Music tracks only (not ambient sounds)
- ✅ No pre-analyzed metadata (real-time compression)
- ✅ Transparent quality (preserve dynamics, 4:1 ratio)
- ✅ Works with existing Howler.js setup

## Implementation Steps

### 1. Create Audio Normalization Hook
**File**: `src/hooks/useAudioNormalization.ts` (NEW)

Custom hook managing DynamicsCompressorNode lifecycle:

```typescript
import { useEffect, useRef } from 'react';
import { Howler } from 'howler';

interface NormalizationConfig {
  enabled: boolean;
  threshold?: number;
  ratio?: number;
  attack?: number;
  release?: number;
  knee?: number;
}

export function useAudioNormalization(config: NormalizationConfig) {
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const originalMasterGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!config.enabled) {
      // Cleanup: restore original audio graph
      if (compressorRef.current && originalMasterGainRef.current) {
        compressorRef.current.disconnect();
        originalMasterGainRef.current.connect(Howler.ctx.destination);
        compressorRef.current = null;
      }
      return;
    }

    // Wait for audio context initialization
    if (!Howler.ctx || Howler.ctx.state === 'suspended') {
      import.meta.env.DEV && console.log('[AudioNormalization] AudioContext not ready');
      return;
    }

    try {
      // Create compressor with transparent settings
      const compressor = Howler.ctx.createDynamicsCompressor();
      compressor.threshold.value = config.threshold ?? -20;
      compressor.ratio.value = config.ratio ?? 4;
      compressor.attack.value = config.attack ?? 0.02;  // 20ms
      compressor.release.value = config.release ?? 0.15; // 150ms
      compressor.knee.value = config.knee ?? 30;

      // Access Howler's internal master gain node
      // @ts-ignore - Howler internal API
      const masterGain = Howler._howlerGain || Howler.masterGain;

      if (!masterGain) {
        console.warn('[AudioNormalization] Could not access Howler master gain');
        return;
      }

      // Rewire audio graph: masterGain → compressor → destination
      masterGain.disconnect();
      masterGain.connect(compressor);
      compressor.connect(Howler.ctx.destination);

      compressorRef.current = compressor;
      originalMasterGainRef.current = masterGain;

      import.meta.env.DEV && console.log('[AudioNormalization] ✓ Compressor active', {
        threshold: compressor.threshold.value,
        ratio: compressor.ratio.value,
      });
    } catch (error) {
      console.error('[AudioNormalization] Failed to initialize:', error);
    }

    return () => {
      // Cleanup on unmount
      if (compressorRef.current && originalMasterGainRef.current) {
        compressorRef.current.disconnect();
        originalMasterGainRef.current.connect(Howler.ctx.destination);
      }
    };
  }, [config.enabled, config.threshold, config.ratio, config.attack, config.release, config.knee]);

  return compressorRef.current;
}
```

### 2. Add Normalization State to Store
**File**: `src/store/useSettingsStore.ts`

Add toggle state (default: enabled):

```typescript
interface SettingsStore extends Settings {
  // ... existing ...
  musicNormalizationEnabled: boolean;
  setMusicNormalizationEnabled: (enabled: boolean) => void;
}

// In create() call:
musicNormalizationEnabled: true, // Default ON
setMusicNormalizationEnabled: (enabled) => set({ musicNormalizationEnabled: enabled }),
```

**File**: `src/types/index.ts`

Add to Settings interface:

```typescript
export interface Settings {
  // ... existing fields ...
  musicNormalizationEnabled: boolean;
}
```

**File**: `src/data/constants.ts`

Add to defaults:

```typescript
export const DEFAULT_SETTINGS: Settings = {
  // ... existing ...
  musicNormalizationEnabled: true,
};
```

### 3. Integrate into MusicPlayer
**File**: `src/components/music/MusicPlayer.tsx`

Add hook call after state declarations (~line 47):

```typescript
import { useAudioNormalization } from '../../hooks/useAudioNormalization';

export function MusicPlayer({ playing, setPlaying, isPIPMode = false }: MusicPlayerProps) {
  // ... existing state ...

  const musicNormalizationEnabled = useSettingsStore((state) => state.musicNormalizationEnabled);

  // Setup normalization (runs after Howler.ctx initialized by ReactHowler)
  useAudioNormalization({
    enabled: musicNormalizationEnabled,
    threshold: -20,  // Start compression at -20dB
    ratio: 4,        // 4:1 gentle compression
    attack: 0.02,    // 20ms fast response
    release: 0.15,   // 150ms musical release
    knee: 30,        // 30dB soft knee (transparent)
  });

  // ... rest unchanged ...
}
```

### 4. (Optional) Add Settings UI Toggle
**File**: `src/components/Settings.tsx`

Add checkbox in Audio settings tab:

```tsx
<div className="flex items-center justify-between">
  <div>
    <Label>Music Normalization</Label>
    <p className="text-xs text-gray-400">
      Normalize volume across tracks
    </p>
  </div>
  <input
    type="checkbox"
    checked={musicNormalizationEnabled}
    onChange={(e) => setMusicNormalizationEnabled(e.target.checked)}
  />
</div>
```

**Note**: Can skip UI if normalization should always be on (it's transparent).

## Audio Graph Diagram

```
BEFORE:
Howler masterGain ──► AudioContext.destination

AFTER:
Howler masterGain ──► DynamicsCompressor ──► AudioContext.destination
                      (threshold: -20dB)
                      (ratio: 4:1)

AMBIENT (unchanged):
Separate Howler instances ──► AudioContext.destination (direct)
```

## Compression Settings Rationale

```
threshold: -20 dB    → Catch loud tracks, preserve quiet passages
ratio: 4:1           → Gentle (transparent), not aggressive
attack: 20ms         → Fast enough for transients, preserves punch
release: 150ms       → Musical, smooth for lofi/synthwave
knee: 30 dB          → Soft transition, inaudible compression
```

## Edge Cases Handled

1. **Mobile audio context suspend**: Existing visibility handler resumes `Howler.ctx`, compressor persists
2. **Context not initialized**: Hook checks and early-returns, activates on first play
3. **Playlist changes**: Hook in parent component, survives ReactHowler remounts
4. **Volume changes**: Occur before compressor, works seamlessly
5. **Browser compatibility**: Try/catch wraps creation, 99%+ browser support

## Testing Checklist

- [ ] Play 3+ tracks from each playlist, verify similar perceived volume
- [ ] A/B test on/off, ensure no audible artifacts
- [ ] Lock phone mid-track, unlock, verify playback continues
- [ ] Toggle in settings (if UI added), verify bypass works
- [ ] Switch playlists while playing, no audio glitches
- [ ] Test Chrome, Firefox, Safari (desktop + mobile)

## Files to Modify

1. `src/hooks/useAudioNormalization.ts` - NEW (core logic)
2. `src/components/music/MusicPlayer.tsx` - Integrate hook
3. `src/store/useSettingsStore.ts` - Add state + action
4. `src/types/index.ts` - Extend Settings interface
5. `src/data/constants.ts` - Add default value
6. `src/components/Settings.tsx` - OPTIONAL UI toggle

## Success Criteria

- Max 3dB volume variance across tracks (subjective test)
- No audible distortion or pumping
- Works on iOS, Android, Chrome, Firefox, Safari
- CPU increase <3%
- No regressions in existing features

## Alternative Considered: Pre-normalize Files

**Pros**: No runtime processing
**Cons**: Requires re-uploading all tracks, can't tune post-deployment
**Verdict**: Runtime solution more flexible

---

## Research Summary

**Current Setup:**
- Uses Howler.js (v2.2.4) + react-howler (v5.2.0)
- Music on Cloudflare R2 CDN as MP3
- Already has Web Audio API access via `Howler.ctx`
- Ambient sounds separate (won't be affected)

**Solution:**
- Web Audio API DynamicsCompressorNode
- Transparent 4:1 compression
- Real-time, no metadata needed
- Negligible CPU impact (<3%)
- Works across all modern browsers
