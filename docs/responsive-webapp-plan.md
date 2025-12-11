# Professional Responsive Webapp Architecture - Complete Implementation Plan

## Project Context
- **Framework**: React + Vite
- **Use Cases**: Browser webapp + Discord activity embed
- **Design System**: Synthwave aesthetic with purple/dark theme
- **Components**: 
  - Top Left: Level UI
  - Bottom: Music Player
  - Left Side: Chat Container
  - Top Right: Settings Panel (modal/popover)
  - User Info Popover
  - Additional UI elements (indicators, controls)

---

## Phase 1: CSS Foundation & Design Tokens

### 1.1 Create Global Responsive Token System

**File**: `src/styles/tokens.css`

```css
:root {
  /* ===== RESPONSIVE BASE UNITS ===== */
  /* These automatically scale with viewport and zoom */
  --space-unit: clamp(4px, 1.5vw, 16px);
  --viewport-width: 100vw;
  --viewport-height: 100vh;

  /* ===== TYPOGRAPHY SCALE (Fluid) ===== */
  /* Minimum / Preferred (vw) / Maximum */
  --text-xs: clamp(10px, 1.2vw, 14px);
  --text-sm: clamp(12px, 1.4vw, 16px);
  --text-base: clamp(14px, 1.6vw, 18px);
  --text-md: clamp(15px, 1.7vw, 19px);
  --text-lg: clamp(16px, 1.8vw, 22px);
  --text-xl: clamp(18px, 2vw, 26px);
  --text-2xl: clamp(24px, 3vw, 36px);
  --text-3xl: clamp(28px, 3.5vw, 44px);

  /* ===== SPACING SCALE ===== */
  --gap-xs: clamp(4px, 0.8vw, 8px);
  --gap-sm: clamp(6px, 1vw, 12px);
  --gap: clamp(8px, 1.2vw, 16px);
  --gap-md: clamp(10px, 1.5vw, 20px);
  --gap-lg: clamp(12px, 1.8vw, 24px);
  --gap-xl: clamp(16px, 2.2vw, 32px);

  /* ===== PADDING SCALE ===== */
  --padding-sm: clamp(8px, 1vw, 12px);
  --padding: clamp(12px, 1.5vw, 20px);
  --padding-md: clamp(14px, 1.8vw, 24px);
  --padding-lg: clamp(16px, 2vw, 28px);
  --padding-xl: clamp(20px, 2.5vw, 36px);

  /* ===== BORDER RADIUS ===== */
  --radius-sm: clamp(3px, 0.5vw, 6px);
  --radius: clamp(6px, 0.8vw, 10px);
  --radius-md: clamp(8px, 1vw, 12px);
  --radius-lg: clamp(10px, 1.2vw, 16px);
  --radius-full: 9999px;

  /* ===== SIZE SCALES (for components) ===== */
  --size-icon-sm: clamp(16px, 2vw, 24px);
  --size-icon: clamp(24px, 3vw, 32px);
  --size-icon-lg: clamp(32px, 4vw, 48px);
  --size-button: clamp(36px, 5vw, 48px);
  --size-card: clamp(120px, 15vw, 200px);

  /* ===== BREAKPOINT-AWARE SIZES ===== */
  --sidebar-width: clamp(250px, 25vw, 400px);
  --settings-width: clamp(300px, 30vw, 500px);
  --chat-width: clamp(200px, 22vw, 350px);
  --music-player-height: clamp(60px, 10vh, 100px);
  --level-ui-width: clamp(150px, 18vw, 280px);

  /* ===== CONTAINER SIZES ===== */
  --container-min: clamp(300px, 95vw, 1400px);
  --max-content-width: clamp(320px, 90vw, 1200px);

  /* ===== DEPTH & SHADOWS ===== */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 8px 16px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 12px 24px rgba(0, 0, 0, 0.2);

  /* ===== TRANSITIONS ===== */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);

  /* ===== THEME COLORS (Synthwave) ===== */
  --color-bg-primary: #0f0a1a;
  --color-bg-secondary: #1a1530;
  --color-bg-tertiary: #251f35;
  --color-text-primary: #e0e0ff;
  --color-text-secondary: #a8a8d8;
  --color-accent-primary: #ff006e;
  --color-accent-secondary: #8338ec;
  --color-accent-tertiary: #3a86ff;
  --color-success: #29e7cd;
  --color-warning: #ffb703;
  --color-error: #fb5607;
}

/* ===== ZOOM & DPI RESPONSIVE ===== */
@media (resolution >= 192dpi) {
  :root {
    --text-base: clamp(14px, 1.8vw, 20px);
    --gap: clamp(8px, 1.3vw, 18px);
  }
}

/* ===== SMALL SCREENS (Mobile/Tablet) ===== */
@media (max-width: 768px) {
  :root {
    --padding: clamp(10px, 2vw, 16px);
    --gap: clamp(6px, 1.5vw, 12px);
    --text-base: clamp(13px, 2vw, 16px);
    --sidebar-width: clamp(150px, 40vw, 280px);
    --settings-width: clamp(200px, 90vw, 350px);
  }
}

/* ===== EXTRA SMALL SCREENS (Phones) ===== */
@media (max-width: 480px) {
  :root {
    --padding: clamp(8px, 2.5vw, 12px);
    --gap: clamp(4px, 2vw, 8px);
    --text-base: clamp(12px, 2.2vw, 15px);
    --size-icon: clamp(20px, 5vw, 28px);
  }
}

/* ===== LARGE SCREENS (Desktop +) ===== */
@media (min-width: 1920px) {
  :root {
    --padding: clamp(14px, 1.2vw, 28px);
    --gap: clamp(10px, 1vw, 20px);
    --text-base: clamp(16px, 1.4vw, 22px);
  }
}

/* ===== DISCORD ACTIVITY CONTEXT ===== */
@media (max-width: 1000px) and (max-height: 600px) {
  :root {
    --padding: clamp(6px, 1vw, 10px);
    --gap: clamp(4px, 0.8vw, 8px);
    --text-base: clamp(12px, 1.5vw, 16px);
    --music-player-height: clamp(50px, 8vh, 70px);
  }
}
```

### 1.2 Create Container Query Base Styles

**File**: `src/styles/containers.css`

```css
/* ===== APP CONTAINER (Root Container Query) ===== */
.app-container {
  container-type: inline-size;
  container-name: app;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--text-base);
}

/* ===== RESPONSIVE LAYOUT GRID ===== */
.app-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr var(--settings-width);
  grid-template-rows: auto 1fr var(--music-player-height);
  gap: var(--gap);
  padding: var(--padding);
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* ===== CONTAINER QUERY BREAKPOINTS ===== */

/* Tablet/Medium Screens: Hide side panels, reorganize */
@container app (max-width: 1200px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr var(--music-player-height);
  }

  .sidebar {
    position: absolute;
    left: 0;
    top: var(--padding);
    width: var(--chat-width);
    height: auto;
    z-index: 10;
    border-radius: var(--radius-lg);
  }

  .settings-panel {
    position: fixed;
    top: var(--padding);
    right: var(--padding);
    width: auto;
    max-width: min(var(--settings-width), 90vw);
    z-index: 20;
  }
}

/* Small Screens: Stack everything vertically */
@container app (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr var(--music-player-height);
    padding: var(--padding-sm);
    gap: var(--gap-sm);
  }

  .level-ui {
    width: 100%;
    order: 1;
  }

  .main-content {
    order: 2;
    overflow-y: auto;
  }

  .sidebar {
    position: fixed;
    left: 0;
    bottom: var(--music-player-height);
    width: var(--chat-width);
    height: auto;
    max-height: 40vh;
    z-index: 10;
  }

  .settings-panel {
    position: fixed;
    top: var(--padding-sm);
    right: var(--padding-sm);
    width: auto;
    z-index: 20;
  }
}

/* Extra Small Screens: Minimize everything */
@container app (max-width: 480px) {
  .app-layout {
    padding: var(--padding-sm);
    gap: var(--gap-xs);
  }

  .sidebar,
  .settings-panel {
    display: none; /* Show as toggles/modals */
  }

  .level-ui {
    width: 100%;
  }
}

/* ===== DISCORD ACTIVITY SPECIFIC ===== */
.app-container.discord-mode {
  --padding: clamp(6px, 1vw, 10px);
  --gap: clamp(4px, 0.8vw, 8px);
  --music-player-height: clamp(50px, 8vh, 70px);
  --settings-width: clamp(250px, 85vw, 350px);
}

.app-container.discord-mode .settings-panel {
  position: fixed;
  max-width: min(var(--settings-width), 90vw);
}
```

---

## Phase 2: Component-Level Responsive Styles

### 2.1 Level UI Component

**File**: `src/styles/components/level-ui.css`

```css
.level-ui {
  width: var(--level-ui-width);
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  padding: var(--padding);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  min-height: auto;
}

.level-ui__title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.level-ui__stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  padding: var(--padding-sm) 0;
  border-bottom: 1px solid var(--color-bg-tertiary);
}

.level-ui__stat:last-child {
  border-bottom: none;
}

.level-ui__value {
  font-weight: 600;
  color: var(--color-accent-primary);
}

.level-ui__progress {
  width: 100%;
  height: clamp(4px, 0.6vw, 8px);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: var(--gap-xs);
}

.level-ui__progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent-secondary), var(--color-accent-primary));
  width: 45%;
  transition: width var(--duration-normal) var(--ease);
}

/* Responsive adjustments */
@container app (max-width: 900px) {
  .level-ui {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    gap: var(--gap);
  }

  .level-ui__stat {
    flex: 1;
    flex-direction: column;
    gap: var(--gap-xs);
  }
}

@container app (max-width: 480px) {
  .level-ui {
    flex-direction: column;
    width: 100%;
    padding: var(--padding-sm);
  }
}
```

### 2.2 Music Player Component

**File**: `src/styles/components/music-player.css`

```css
.music-player {
  width: 100%;
  height: var(--music-player-height);
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--gap);
  padding: var(--padding);
  background: linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-tertiary));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  align-items: center;
  overflow: hidden;
}

.music-player__cover {
  width: clamp(40px, 8vh, 80px);
  aspect-ratio: 1;
  border-radius: var(--radius);
  object-fit: cover;
  box-shadow: var(--shadow-md);
  flex-shrink: 0;
}

.music-player__info {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xs);
  min-width: 0;
}

.music-player__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-player__artist {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-player__progress {
  width: 100%;
  height: clamp(2px, 0.5vh, 4px);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.music-player__progress-bar {
  height: 100%;
  background: var(--color-accent-primary);
  width: 35%;
  border-radius: var(--radius-full);
}

.music-player__controls {
  display: flex;
  gap: var(--gap-sm);
  align-items: center;
  flex-shrink: 0;
}

.music-player__button {
  width: var(--size-icon);
  height: var(--size-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-secondary);
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  color: white;
  font-size: calc(var(--size-icon) * 0.5);
  transition: all var(--duration-fast) var(--ease);
}

.music-player__button:hover {
  background: var(--color-accent-primary);
  transform: scale(1.05);
}

.music-player__time {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Responsive adjustments */
@container app (max-width: 1000px) {
  .music-player {
    grid-template-columns: auto 1fr;
    gap: var(--gap-sm);
  }

  .music-player__controls {
    grid-column: 1 / -1;
    width: 100%;
    justify-content: space-between;
  }

  .music-player__info {
    grid-column: 2;
  }
}

@container app (max-width: 480px) {
  .music-player {
    height: var(--music-player-height);
    grid-template-columns: auto 1fr;
    padding: var(--padding-sm);
  }

  .music-player__cover {
    display: none;
  }

  .music-player__controls {
    width: 100%;
    grid-column: 1 / -1;
  }

  .music-player__time {
    display: none;
  }
}
```

### 2.3 Chat Container Component

**File**: `src/styles/components/chat.css`

```css
.chat-container {
  width: var(--chat-width);
  height: clamp(200px, 60vh, 600px);
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  padding: var(--padding);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.chat-header {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text-primary);
  padding-bottom: var(--gap-sm);
  border-bottom: 1px solid var(--color-bg-tertiary);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  padding-right: clamp(2px, 0.5vw, 6px);
}

.chat-message {
  max-width: clamp(200px, 100%, 300px);
  padding: var(--padding-sm) var(--padding);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.chat-message.user {
  align-self: flex-end;
  background: var(--color-accent-secondary);
  color: white;
}

.chat-input {
  display: flex;
  gap: var(--gap-sm);
  padding-top: var(--gap-sm);
  border-top: 1px solid var(--color-bg-tertiary);
}

.chat-input__field {
  flex: 1;
  padding: var(--padding-sm) var(--padding);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-bg-tertiary);
  border-radius: var(--radius);
  color: var(--color-text-primary);
  font-size: var(--text-sm);
}

.chat-input__button {
  padding: var(--padding-sm) var(--padding);
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--radius);
  color: white;
  cursor: pointer;
  font-size: var(--text-sm);
  transition: all var(--duration-fast) var(--ease);
}

.chat-input__button:hover {
  background: var(--color-accent-secondary);
}

/* Responsive adjustments */
@container app (max-width: 1200px) {
  .chat-container {
    position: fixed;
    width: var(--chat-width);
    height: auto;
    max-height: 40vh;
    bottom: calc(var(--music-player-height) + var(--gap));
  }
}

@container app (max-width: 768px) {
  .chat-container {
    width: clamp(200px, 60vw, 300px);
  }

  .chat-message {
    max-width: 100%;
  }
}

@container app (max-width: 480px) {
  .chat-container {
    display: none; /* Show as modal/toggle */
  }
}
```

### 2.4 Settings Panel Component

**File**: `src/styles/components/settings.css`

```css
.settings-panel {
  position: fixed;
  top: var(--padding);
  right: var(--padding);
  width: var(--settings-width);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  padding: var(--padding-lg);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow-y: auto;
  z-index: 100;
  animation: slideInRight var(--duration-normal) var(--ease);
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.settings-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--gap);
  border-bottom: 1px solid var(--color-bg-tertiary);
}

.settings-panel__title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.settings-panel__close {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--text-lg);
  padding: 0;
  width: var(--size-icon);
  height: var(--size-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--ease);
}

.settings-panel__close:hover {
  color: var(--color-text-primary);
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

.settings-group__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-group__control {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  padding: var(--padding-sm);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius);
}

.settings-slider {
  flex: 1;
  height: clamp(3px, 0.5vh, 6px);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.settings-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: clamp(12px, 1.5vw, 20px);
  height: clamp(12px, 1.5vw, 20px);
  background: var(--color-accent-primary);
  border-radius: var(--radius-full);
  cursor: pointer;
  box-shadow: var(--shadow);
}

.settings-slider::-moz-range-thumb {
  width: clamp(12px, 1.5vw, 20px);
  height: clamp(12px, 1.5vw, 20px);
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  box-shadow: var(--shadow);
}

.settings-value {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  min-width: 40px;
  text-align: right;
}

.settings-toggle {
  width: clamp(40px, 6vw, 60px);
  height: clamp(24px, 3.5vw, 32px);
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  cursor: pointer;
  position: relative;
  transition: all var(--duration-fast) var(--ease);
}

.settings-toggle.active {
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
}

.settings-toggle__dot {
  width: clamp(18px, 2.5vw, 26px);
  height: clamp(18px, 2.5vw, 26px);
  background: white;
  border-radius: var(--radius-full);
  position: absolute;
  top: 50%;
  left: 2px;
  transform: translateY(-50%);
  transition: all var(--duration-fast) var(--ease);
}

.settings-toggle.active .settings-toggle__dot {
  left: auto;
  right: 2px;
}

/* Responsive adjustments */
@container app (max-width: 1200px) {
  .settings-panel {
    width: min(var(--settings-width), 85vw);
    max-height: 80vh;
  }
}

@container app (max-width: 768px) {
  .settings-panel {
    width: min(var(--settings-width), 90vw);
    height: auto;
    max-height: 90vh;
  }
}

@container app (max-width: 480px) {
  .settings-panel {
    width: min(var(--settings-width), 95vw);
    padding: var(--padding);
  }
}
```

### 2.5 User Info Popover Component

**File**: `src/styles/components/user-popover.css`

```css
.user-popover {
  position: absolute;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
  padding: var(--padding-lg);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  min-width: clamp(200px, 25vw, 300px);
  animation: popIn var(--duration-fast) var(--ease);
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.user-popover__avatar {
  width: clamp(60px, 10vw, 100px);
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  object-fit: cover;
  margin-bottom: var(--gap);
}

.user-popover__name {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--gap-xs) 0;
}

.user-popover__status {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--gap);
}

.user-popover__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap);
  padding-top: var(--gap);
  border-top: 1px solid var(--color-bg-tertiary);
  margin-bottom: var(--gap);
}

.user-popover__stat {
  text-align: center;
}

.user-popover__stat-value {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-accent-primary);
}

.user-popover__stat-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.user-popover__actions {
  display: flex;
  gap: var(--gap-sm);
}

.user-popover__button {
  flex: 1;
  padding: var(--padding-sm) var(--padding);
  background: var(--color-accent-secondary);
  border: none;
  border-radius: var(--radius);
  color: white;
  cursor: pointer;
  font-size: var(--text-sm);
  transition: all var(--duration-fast) var(--ease);
}

.user-popover__button:hover {
  background: var(--color-accent-primary);
}

/* Responsive adjustments */
@container app (max-width: 768px) {
  .user-popover {
    min-width: clamp(200px, 80vw, 280px);
  }
}

@container app (max-width: 480px) {
  .user-popover {
    min-width: min(clamp(180px, 90vw, 280px));
    padding: var(--padding);
  }

  .user-popover__stats {
    grid-template-columns: 1fr;
  }
}
```

---

## Phase 3: React Component Implementation

### 3.1 Hook for Responsive Context Detection

**File**: `src/hooks/useResponsiveContext.ts`

```typescript
import { useEffect, useState } from 'react';

interface ResponsiveContext {
  isSmallScreen: boolean;
  isMediumScreen: boolean;
  isLargeScreen: boolean;
  isDiscordMode: boolean;
  zoom: number;
  width: number;
  height: number;
}

export function useResponsiveContext(): ResponsiveContext {
  const [context, setContext] = useState<ResponsiveContext>({
    isSmallScreen: false,
    isMediumScreen: false,
    isLargeScreen: false,
    isDiscordMode: false,
    zoom: 100,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const detectDiscordMode = () => {
      return (
        window.top !== window.self ||
        navigator.userAgent.includes('Discord') ||
        typeof (window as any).discordSdk !== 'undefined'
      );
    };

    const getZoomLevel = () => {
      const zoom =
        (window.devicePixelRatio * 100) /
        (window.screen.width / window.innerWidth);
      return Math.round(zoom);
    };

    const updateContext = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const zoom = getZoomLevel();

      setContext({
        isSmallScreen: width <= 768,
        isMediumScreen: width > 768 && width <= 1200,
        isLargeScreen: width > 1200,
        isDiscordMode: detectDiscordMode(),
        zoom,
        width,
        height,
      });
    };

    updateContext();

    // Listen for resize and zoom changes
    window.addEventListener('resize', updateContext);
    window.addEventListener('orientationchange', updateContext);

    // Detect zoom changes
    const zoomCheckInterval = setInterval(updateContext, 500);

    return () => {
      window.removeEventListener('resize', updateContext);
      window.removeEventListener('orientationchange', updateContext);
      clearInterval(zoomCheckInterval);
    };
  }, []);

  return context;
}
```

### 3.2 Main App Layout Component

**File**: `src/components/AppLayout.tsx`

```typescript
import React from 'react';
import { useResponsiveContext } from '../hooks/useResponsiveContext';
import LevelUI from './LevelUI';
import MusicPlayer from './MusicPlayer';
import ChatContainer from './ChatContainer';
import SettingsPanel from './SettingsPanel';
import MainContent from './MainContent';
import '../styles/tokens.css';
import '../styles/containers.css';

export default function AppLayout() {
  const context = useResponsiveContext();

  return (
    <div
      className={`app-container ${context.isDiscordMode ? 'discord-mode' : ''}`}
      style={{
        '--viewport-width': `${context.width}px`,
        '--viewport-height': `${context.height}px`,
        '--zoom-level': `${context.zoom}%`,
      } as React.CSSProperties}
    >
      <div className="app-layout">
        {/* Top Left: Level UI - Always visible on larger screens */}
        {!context.isSmallScreen && (
          <div style={{ gridColumn: '1', gridRow: '1' }}>
            <LevelUI />
          </div>
        )}

        {/* Main Content Area */}
        <div style={{ gridColumn: context.isSmallScreen ? '1' : '2', gridRow: context.isSmallScreen ? '2' : '1 / 3' }}>
          <MainContent />
        </div>

        {/* Top Right: Settings Panel - Can be fixed positioned */}
        <SettingsPanel isVisible={true} />

        {/* Left Side: Chat (shows on larger screens, can be toggle on mobile) */}
        {!context.isSmallScreen && (
          <ChatContainer />
        )}

        {/* Bottom: Music Player - Spans full width */}
        <div style={{ gridColumn: '1 / -1', gridRow: '3' }}>
          <MusicPlayer />
        </div>
      </div>
    </div>
  );
}
```

### 3.3 Component Base Template

**File**: `src/components/ComponentTemplate.tsx`

```typescript
import React, { useMemo } from 'react';
import { useResponsiveContext } from '../hooks/useResponsiveContext';

interface ComponentProps {
  className?: string;
}

export default function ComponentTemplate({ className = '' }: ComponentProps) {
  const context = useResponsiveContext();

  // Memoize context-dependent calculations
  const computedStyles = useMemo(() => ({
    isCompact: context.isSmallScreen,
    shouldHideLabel: context.zoom > 150, // Hide labels if zoomed in heavily
    maxItems: context.isMediumScreen ? 3 : context.isSmallScreen ? 2 : 5,
  }), [context]);

  return (
    <div
      className={`component ${computedStyles.isCompact ? 'compact' : ''} ${className}`}
      style={{
        // Pass zoom level to CSS for fine-tuning
        '--component-zoom': `${context.zoom / 100}`,
      } as React.CSSProperties}
    >
      {/* Component content */}
    </div>
  );
}
```

---

## Phase 4: Vite Configuration & Build Optimization

### 4.1 Vite Config

**File**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 5173,
    open: true,
  },
});
```

### 4.2 PostCSS Configuration

**File**: `postcss.config.js`

```javascript
export default {
  plugins: {
    autoprefixer: {
      overrideBrowserslist: [
        '> 1%',
        'last 2 versions',
        'not dead',
      ],
    },
  },
};
```

### 4.3 Package Dependencies

**File**: `package.json` (dependencies section)

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@uidotdev/usehooks": "^4.1.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "terser": "^5.26.0"
  }
}
```

---

## Phase 5: Testing & Validation Checklist

### 5.1 Responsive Testing Strategy

**File**: `TESTING_CHECKLIST.md`

```markdown
## Viewport Size Testing
- [ ] 375px (iPhone SE)
- [ ] 480px (Small phone)
- [ ] 768px (Tablet)
- [ ] 1024px (iPad)
- [ ] 1200px (Laptop)
- [ ] 1366px (Desktop common)
- [ ] 1920px (Full HD)
- [ ] 2560px (4K)

## Zoom Level Testing
- [ ] 75% zoom
- [ ] 100% zoom (default)
- [ ] 125% zoom
- [ ] 150% zoom
- [ ] 200% zoom (extreme)

## Discord Activity Specific
- [ ] Embedded size (~250px width)
- [ ] Popout size (~600px width)
- [ ] Activities modal (~1200x800px)

## Device Testing
- [ ] Safari (macOS)
- [ ] Chrome (Windows, macOS, Linux)
- [ ] Firefox (all platforms)
- [ ] Edge (Windows)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Browser DevTools Testing
- [ ] Chrome DevTools: Device emulation
- [ ] Chrome DevTools: CSS Grid overlay
- [ ] Firefox: Responsive design mode
- [ ] Accessibility inspector (color contrast, focus)

## Performance Metrics
- [ ] Core Web Vitals (LCP, FID, CLS)
- [ ] Font loading performance
- [ ] CSS delivery performance
- [ ] Zoom performance (smooth at 200%)
- [ ] No layout shifts during zoom
```

### 5.2 Component-Specific Testing

Test each component at critical breakpoints:

```typescript
// src/__tests__/responsive.test.ts
describe('Responsive Design', () => {
  describe('LevelUI', () => {
    test('should display as row on medium screens', () => {
      // Render at 900px
      // Assert grid-template-columns changes
    });

    test('should display as column on small screens', () => {
      // Render at 480px
      // Assert responsive layout
    });
  });

  describe('MusicPlayer', () => {
    test('should hide cover on mobile', () => {
      // Render at 480px
      // Assert cover is hidden/display:none
    });

    test('should stack controls vertically on zoom', () => {
      // Simulate 200% zoom
      // Assert controls arrangement
    });
  });

  describe('SettingsPanel', () => {
    test('should adjust width based on viewport', () => {
      // Test at various widths
      // Assert width follows clamp() rules
    });

    test('should remain accessible on Discord embed', () => {
      // Render in Discord context
      // Assert all controls are clickable
    });
  });
});
```

---

## Phase 6: Discord Integration Specifics

### 6.1 Discord Activity Detection & Adaptation

**File**: `src/utils/discordDetection.ts`

```typescript
export function detectDiscordContext(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.top !== window.self ||
    navigator.userAgent.includes('Discord') ||
    typeof (window as any).discordSdk !== 'undefined' ||
    window.location.hash.includes('discord')
  );
}

export function getDiscordActivityDimensions() {
  // Discord embedded activities
  return {
    embedded: { width: 250, height: 600 }, // Embedded in user profile
    popout: { width: 600, height: 800 },   // Popout modal
    modal: { width: 1200, height: 800 },   // Full modal
  };
}

export function initializeDiscordActivity() {
  if (!detectDiscordContext()) return;

  // Add Discord-specific adaptations
  document.documentElement.classList.add('discord-mode');

  // Tighter constraints for Discord
  document.documentElement.style.setProperty('--padding', 'clamp(6px, 1vw, 10px)');
  document.documentElement.style.setProperty('--gap', 'clamp(4px, 0.8vw, 8px)');
}
```

### 6.2 Component Visibility Control in Discord

**File**: `src/components/Discord-aware.tsx`

```typescript
import { useResponsiveContext } from '../hooks/useResponsiveContext';

export function DiscordAwareComponent({ children }: { children: React.ReactNode }) {
  const { isDiscordMode, width } = useResponsiveContext();

  if (isDiscordMode && width < 300) {
    // In Discord embedded view
    return <MobileLayout>{children}</MobileLayout>;
  }

  if (isDiscordMode && width < 700) {
    // In Discord popout view
    return <TabletLayout>{children}</TabletLayout>;
  }

  // Regular browser
  return <DesktopLayout>{children}</DesktopLayout>;
}
```

---

## Phase 7: Performance Optimization

### 7.1 CSS Optimization

```css
/* Use CSS containment for performance */
.app-container {
  contain: layout style paint;
}

.component {
  contain: layout style paint;
}

/* Minimize repaints during zoom */
.music-player {
  will-change: transform;
}

/* Optimize animations */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 7.2 JavaScript Optimization

```typescript
// Debounce resize/zoom listeners
import { debounce } from 'lodash-es';

const debouncedResize = debounce(() => {
  // Handle resize
}, 250);

window.addEventListener('resize', debouncedResize);
```

---

## Phase 8: Deployment Checklist

### 8.1 Pre-Deployment

- [ ] All components tested at 75%, 100%, 125%, 150%, 200% zoom
- [ ] Tested on mobile, tablet, desktop, and Discord embed
- [ ] No layout shifts or content overflow
- [ ] Accessibility audit passed (color contrast, focus states)
- [ ] Performance metrics acceptable (LCP <2.5s, CLS <0.1)
- [ ] CSS variables properly defined and inherited
- [ ] Container queries working in target browsers
- [ ] No hardcoded pixel values (except design tokens)

### 8.2 Build Commands

```bash
# Development
npm run dev

# Build production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Testing
npm run test
```

---

## Summary of Key Principles

1. **Use `clamp()` for fluid scaling** - Automatically responds to viewport and zoom
2. **CSS Custom Properties for tokens** - Centralized, responsive design system
3. **Container Queries for layout logic** - Components adapt independently
4. **Relative units everywhere** - `em`, `rem`, `vw`, `vh`, `%` instead of fixed `px`
5. **Separate mobile/tablet/desktop layouts** - Use CSS media queries and React state
6. **Discord-aware adaptations** - Detect context and adjust constraints
7. **Test comprehensively** - Zoom levels, viewports, and embed contexts
8. **Performance first** - CSS containment, debounced listeners, optimized animations
9. **No hardcoded sizes** - Everything derives from tokens
10. **Professional polish** - Smooth transitions, proper focus states, accessibility

---

## File Structure

```
src/
├── styles/
│   ├── tokens.css              # Global design tokens
│   ├── containers.css          # Layout & container queries
│   └── components/
│       ├── level-ui.css
│       ├── music-player.css
│       ├── chat.css
│       ├── settings.css
│       └── user-popover.css
├── components/
│   ├── AppLayout.tsx
│   ├── LevelUI.tsx
│   ├── MusicPlayer.tsx
│   ├── ChatContainer.tsx
│   ├── SettingsPanel.tsx
│   ├── MainContent.tsx
│   └── UserPopover.tsx
├── hooks/
│   └── useResponsiveContext.ts
├── utils/
│   └── discordDetection.ts
├── __tests__/
│   └── responsive.test.ts
├── App.tsx
└── main.tsx
```

---

## Quick Reference: CSS Custom Properties Priority

| Property | Usage | Example |
|----------|-------|---------|
| `--space-unit` | Base unit for calculations | `calc(var(--space-unit) * 2)` |
| `clamp()` | Fluid scaling | `font-size: clamp(14px, 1.6vw, 18px)` |
| `vw/vh` | Viewport-relative | `width: 25vw` |
| `em/rem` | Relative to font | `margin: 1em` |
| Container queries | Component-level responsiveness | `@container app (max-width: 800px)` |
| Media queries | Device-level responsiveness | `@media (max-width: 768px)` |

---

## Next Steps After Implementation

1. Implement Phase 1-3 (CSS tokens and components)
2. Build React components with responsive hooks
3. Set up Vite configuration
4. Run comprehensive testing checklist
5. Deploy and monitor real-world zoom behavior
6. Gather Discord user feedback for further refinement
7. Optimize based on actual usage patterns

This plan provides production-ready responsive design that scales beautifully across all contexts while maintaining professional quality and accessibility.