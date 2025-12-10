# Performance Optimization Plan - Phases 3-6

## Context

**Project**: Pomodoro Discord Activity + Web App (React 19, TypeScript, Vite, Supabase)
**Goal**: Lag-free, consistent performance (mobile Discord Activity + desktop)

**✅ COMPLETED:**
- **Phase 1**: SVG Crisis - 12MB removed from bundle, lazy loaded
- **Phase 2**: Code Splitting - Main bundle 1,274KB → 797KB (40.6% gzip reduction)

**📋 REMAINING:** Phases 3-6 (Runtime optimizations + Build config)

---

## PHASE 3: Component Memoization (HIGH Priority)

**Impact**: 50-70% re-render reduction | **Effort**: 2-3h | **Risk**: LOW

### Objective
Eliminate unnecessary re-renders in heavy components, especially settings tabs and chat.

### Changes Required

#### 3.1 Settings Modal Tab Extraction
**File**: `src/components/settings/SettingsModal.tsx` (981 lines)

**Problem**: All 6 tabs re-render when switching tabs (lines 407-937)

**Solution**: Extract each tab panel to memoized component

**Implementation**:
1. Create 6 new components in `src/components/settings/tabs/`:
   - `TimerTab.tsx` (lines 407-545)
   - `AppearanceTab.tsx` (lines 546-647)
   - `SoundsTab.tsx` (lines 648-747)
   - `NotificationsTab.tsx` (lines 748-807)
   - `ProgressTab.tsx` (lines 808-887)
   - `AboutTab.tsx` (lines 888-937)

2. Wrap each with `React.memo()`

3. Update `SettingsModal.tsx`:
```tsx
import { TimerTab, AppearanceTab, SoundsTab, NotificationsTab, ProgressTab, AboutTab } from './tabs';

// Replace lines 407-937 with:
{activeTab === 'timer' && <TimerTab />}
{activeTab === 'appearance' && <AppearanceTab />}
{activeTab === 'sounds' && <SoundsTab />}
{activeTab === 'notifications' && <NotificationsTab />}
{activeTab === 'progress' && <ProgressTab />}
{activeTab === 'about' && <AboutTab />}
```

**Success Metric**: Tab switch 80ms → <15ms

---

#### 3.2 Chat Virtualization
**File**: `src/components/chat/GlobalChat.tsx`

**Problem**: All 50+ messages re-render on scroll

**Solution**: Replace manual scroll with react-window

**Implementation**:
1. Install dependency:
```bash
npm install react-window @types/react-window
```

2. Update `GlobalChat.tsx`:
```tsx
import { FixedSizeList } from 'react-window';

// Replace current message rendering (lines ~120-180) with:
<FixedSizeList
  height={containerHeight}
  itemCount={messages.length}
  itemSize={80}
  width="100%"
  ref={listRef}
>
  {({ index, style }) => (
    <div style={style}>
      <ChatMessage message={messages[index]} />
    </div>
  )}
</FixedSizeList>
```

3. Implement auto-scroll on new messages:
```tsx
useEffect(() => {
  if (listRef.current && shouldAutoScroll) {
    listRef.current.scrollToItem(messages.length - 1, 'end');
  }
}, [messages.length]);
```

**Success Metric**: Chat 45fps → 60fps with 50+ messages

---

#### 3.3 Tooltip Position Throttling
**File**: `src/components/level/LevelDisplay.tsx` (lines 186-220)

**Problem**: `updateTooltipPosition` runs 60 times/sec on mouse move

**Solution**: Throttle with requestAnimationFrame

**Implementation**:
```tsx
// Add state for RAF
const rafPending = useRef(false);

const updateTooltipPosition = (e: MouseEvent) => {
  if (rafPending.current) return;

  rafPending.current = true;
  requestAnimationFrame(() => {
    // Existing position calculation code here
    rafPending.current = false;
  });
};
```

**Success Metric**: Tooltip updates smooth, CPU usage -20%

---

### Testing Phase 3
1. **Settings tabs**: Open settings, rapidly switch tabs → no lag
2. **Chat scroll**: Add 100 messages, scroll rapidly → 60fps
3. **Tooltip**: Hover buffs rapidly → smooth movement
4. **Build**: `npm run build` → no errors

---

## PHASE 4: Animation Optimization (MEDIUM Priority)

**Impact**: 60fps animations | **Effort**: 2-3h | **Risk**: LOW

### Objective
Force GPU acceleration for all animations, eliminate layout thrashing.

### Changes Required

#### 4.1 Confetti GPU Acceleration
**File**: `src/components/level/LevelDisplay.tsx` (lines 288-334)

**Problem**: 90 confetti particles running on CPU (30-40fps)

**Solution**: Add GPU hints

**Implementation**:
```tsx
// Line ~300, confetti particle style:
style={{
  position: 'absolute',
  left: `${particle.x}%`,
  top: `${particle.y}%`,
  fontSize: `${particle.size}px`,
  opacity: particle.opacity,
  transform: `rotate(${particle.rotation}deg) translateZ(0)`, // ← Add translateZ(0)
  willChange: 'transform, opacity', // ← Add willChange
}}
```

**Success Metric**: Confetti 30-40fps → 60fps

---

#### 4.2 Progress Bar Wave GPU
**File**: `src/components/level/LevelDisplay.tsx` (lines 380-395)

**Problem**: CSS wave animation may use CPU

**Solution**: Add GPU hints

**Implementation**:
```tsx
// Line ~385, wave overlay style:
style={{
  background: `linear-gradient(...)`,
  animation: 'wave 2s ease-in-out infinite',
  willChange: 'transform', // ← Add
  transform: 'translateZ(0)', // ← Add
}}
```

---

#### 4.3 Music Player Fade GPU
**File**: `src/components/music/MusicPlayer.tsx` (lines 171-176)

**Problem**: Opacity fade may not use GPU

**Solution**: Add GPU hints to fade animation

**Implementation**:
```tsx
// Framer Motion component, add to motion props:
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  style={{
    willChange: 'opacity',
    transform: 'translateZ(0)',
  }}
>
```

---

### Testing Phase 4
1. **Level up**: Trigger confetti → smooth 60fps (check DevTools performance)
2. **Progress bar**: Watch wave animation → no jank
3. **Music player**: Open/close rapidly → smooth fade
4. **Chrome DevTools**: Record performance, check for layout recalculation warnings

---

## PHASE 5: Event Throttling (MEDIUM Priority)

**Impact**: CPU -40% | **Effort**: 1.5h | **Risk**: LOW

### Objective
Reduce event handler frequency to necessary minimum.

### Changes Required

#### 5.1 Mouse Activity Throttle
**File**: `src/hooks/useMouseActivity.ts` (lines 35-47)

**Problem**: Mouse events fire 60 times/sec

**Solution**: Throttle to 15fps (60ms)

**Implementation**:
```tsx
// Add throttle helper at top of file:
const throttle = (fn: Function, ms: number) => {
  let lastTime = 0;
  return (...args: any[]) => {
    const now = Date.now();
    if (now - lastTime >= ms) {
      lastTime = now;
      fn(...args);
    }
  };
};

// Update event listener (line ~40):
useEffect(() => {
  const handleActivity = throttle(() => {
    setLastActivity(Date.now());
  }, 60); // 60ms = ~15fps

  window.addEventListener('mousemove', handleActivity);
  window.addEventListener('keydown', handleActivity);

  return () => {
    window.removeEventListener('mousemove', handleActivity);
    window.removeEventListener('keydown', handleActivity);
  };
}, []);
```

**Success Metric**: Mouse events 60/sec → 15/sec

---

#### 5.2 Music Seek RAF + Throttle
**File**: `src/components/music/MusicPlayer.tsx` (lines 66-85)

**Problem**: `setInterval(updateSeek, 100)` runs 10 times/sec

**Solution**: Use requestAnimationFrame + throttle to 250ms

**Implementation**:
```tsx
// Replace setInterval with RAF:
useEffect(() => {
  let lastUpdate = 0;
  let rafId: number;

  const updateSeek = (timestamp: number) => {
    if (timestamp - lastUpdate >= 250) { // 250ms = 4 updates/sec
      const howler = soundRef.current?.howler;
      if (howler && playing) {
        setSeek(howler.seek());
      }
      lastUpdate = timestamp;
    }
    rafId = requestAnimationFrame(updateSeek);
  };

  if (playing) {
    rafId = requestAnimationFrame(updateSeek);
  }

  return () => cancelAnimationFrame(rafId);
}, [playing]);
```

**Success Metric**: Seek updates 10/sec → 4/sec, CPU -30-40%

---

### Testing Phase 5
1. **Mouse**: Move cursor rapidly → reduced CPU (check Task Manager)
2. **Music seek**: Play music, watch seek bar → smooth updates, less CPU
3. **Idle state**: Leave mouse idle → events stop firing

---

## PHASE 6: Build Config (LOW Priority)

**Impact**: 5-10% reduction | **Effort**: 1h | **Risk**: VERY LOW

### Objective
Production-only optimizations, bundle analysis.

### Changes Required

#### 6.1 Terser Advanced Options
**File**: `vite.config.ts`

**Current**: Basic terser minification

**Solution**: Add production-only console removal

**Implementation**:
```ts
// Update build config:
build: {
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: process.env.NODE_ENV === 'production',
      drop_debugger: true,
      pure_funcs: ['console.log', 'console.info'],
    },
    format: {
      comments: false,
    },
  },
  sourcemap: process.env.NODE_ENV !== 'production',
  // ... existing rollupOptions
}
```

**Important**: Console.logs only removed in **production**, kept in dev for debugging

---

#### 6.2 Bundle Size Limits
**File**: `vite.config.ts`

**Solution**: Set warning thresholds

**Implementation**:
```ts
build: {
  // ... existing config
  chunkSizeWarningLimit: 600, // Warn if chunk > 600KB
  rollupOptions: {
    output: {
      manualChunks: {
        // ... existing chunks
      },
      // Optimize chunk names for caching
      chunkFileNames: 'assets/[name]-[hash].js',
      assetFileNames: 'assets/[name]-[hash][extname]',
    },
  },
}
```

---

#### 6.3 Bundle Analysis Commands
**File**: `package.json`

**Solution**: Add analysis script

**Implementation**:
```json
{
  "scripts": {
    "build": "tsc -b && vite build",
    "build:analyze": "tsc -b && vite build && open dist/stats.html",
    "preview": "vite preview"
  }
}
```

Usage: `npm run build:analyze` → opens bundle visualization

---

### Testing Phase 6
1. **Dev build**: Console.logs should work
2. **Prod build**: `NODE_ENV=production npm run build` → no console.logs in bundle
3. **Bundle size**: Check dist/ folder, verify chunks < 600KB
4. **Analyze**: `npm run build:analyze` → view bundle breakdown

---

## Success Metrics Summary

### Load Time Goals
- Initial bundle: 797KB → 750KB gzip
- Time to Interactive: 1.5s → 1.2s
- Lighthouse score: 80+ → 90+

### Runtime Goals
- Settings tab switch: 80ms → 8ms ✅ (Phase 3)
- Confetti animation: 40fps → 60fps ✅ (Phase 4)
- Chat scroll: 45fps → 60fps ✅ (Phase 3)
- CPU idle: 15-20% → 5-8% ✅ (Phase 5)

### Final Bundle Structure
```
Main (index):        750KB (190KB gzip) - After Phase 3-6 optimizations
Vendor chunks:       414KB loaded on demand
Component chunks:     82KB loaded on demand
SVGs:                Lazy loaded when visible
Total initial load:  ~190KB gzip
```

---

## Implementation Order

**Week 1**:
- Day 1: Phase 3.1 (Settings tabs)
- Day 2: Phase 3.2 + 3.3 (Chat virtualization + tooltip)
- Day 3: Phase 4 (All GPU optimizations)
- Day 4: Phase 5 (Event throttling)
- Day 5: Phase 6 (Build config) + Testing

**Testing Checklist**:
- [ ] Settings tabs switch fast (<15ms)
- [ ] Chat scroll smooth with 100+ messages (60fps)
- [ ] Confetti smooth at 60fps
- [ ] Music seek bar smooth, low CPU
- [ ] Console.logs removed in production build
- [ ] Bundle visualizer opens (`npm run build:analyze`)
- [ ] No TypeScript errors
- [ ] Mobile Discord Activity smooth
- [ ] Desktop browser smooth

---

## Critical Files Reference

**Phase 3**:
- `src/components/settings/SettingsModal.tsx` (407-937)
- `src/components/chat/GlobalChat.tsx` (120-180)
- `src/components/level/LevelDisplay.tsx` (186-220)

**Phase 4**:
- `src/components/level/LevelDisplay.tsx` (288-334, 380-395)
- `src/components/music/MusicPlayer.tsx` (171-176)

**Phase 5**:
- `src/hooks/useMouseActivity.ts` (35-47)
- `src/components/music/MusicPlayer.tsx` (66-85)

**Phase 6**:
- `vite.config.ts`
- `package.json`

---

## Notes for Claude Web Version

**Context**: This is a React 19 + TypeScript + Vite project. Phases 1-2 already completed (SVG optimization + code splitting).

**Tools Available**:
- Read, Edit, Write tools for files
- Bash tool for npm commands
- Glob/Grep for searching

**Workflow**:
1. Start with Phase 3.1 (Settings tabs)
2. Build and test after each sub-phase
3. Commit after each phase completes
4. Provide clear progress updates

**Important**:
- Always read files before editing
- Test build after each phase
- Follow CLAUDE.md: be concise, update PROJECT.md if needed
- Don't skip testing steps

**Dependencies to Install**:
- Phase 3.2: `npm install react-window @types/react-window`
