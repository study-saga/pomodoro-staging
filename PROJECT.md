# Pomodoro Timer - Discord Activity

A Pomodoro timer application built as a Discord Activity, featuring study tracking, XP/leveling system, and cross-device sync.

## Quick Links

📖 **[Architecture & Design](docs/ARCHITECTURE.md)** - How the system works
🎯 **[Features & Components](docs/FEATURES.md)** - What features exist
🔐 **[Authentication & Security](docs/AUTH.md)** - Auth systems & security
🗄️ **[Database Reference](docs/DATABASE.md)** - Schema, RPCs, utilities
🛠️ **[Development & Deployment](docs/DEVELOPMENT.md)** - Dev workflow & deployment
🤝 **[Contributing Guide](docs/CONTRIBUTING.md)** - How to contribute

---

## Project Overview

This is a feature-rich Pomodoro timer that runs as a Discord Activity, allowing friends to study together in voice channels. The app includes:

- **Pomodoro Timer**: Custom durations (1-120 min), auto-start options
- **XP & Leveling**: 2 XP/min (pomodoro), 1 XP/min (breaks), max level 20. Auto-calculates via trigger when XP exact threshold met
- **Daily Gifts**: Random XP rewards (10-100) for logging in, day 10 = +25% boost (24hrs)
- **Break XP Sync**: Breaks award 1 XP/min synced to DB with +25% boost support
- **Music & Sounds**: 2 playlists (Lofi, Synthwave), 9 ambient sounds
- **Cross-Device Sync**: Settings and progress sync across all devices with 500ms debounce
- **Discord Integration**: Runs natively in Discord voice channels as an Activity
- **Web Version**: Also accessible via browser at study-saga.com

---

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand with persist middleware (51 fields)
- **Discord Integration**: @discord/embedded-app-sdk v2.4.0
- **Notifications**: Sonner v2.0.7 (toast notifications)

### Backend
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth + Discord OAuth
- **Edge Functions**: Deno (Discord token exchange)
- **Storage**: Supabase Storage (future: user uploads)

### Infrastructure
- **Frontend Hosting**: Vercel
- **Backend**: Supabase (database, auth, edge functions)
- **CDN**: Cloudflare (static assets)
- **DNS**: Cloudflare

---

## Documentation Structure

This project uses modular documentation for easier navigation:

### 📖 [Architecture & Design](docs/ARCHITECTURE.md)
- Code Organization & Patterns
- System Architecture
- State Management (Zustand)
- Dual Authentication (Web + Discord Activity)
- Migration History & Architecture Decisions
- Performance Considerations

### 🎯 [Features & Components](docs/FEATURES.md)
- Key Features (timer, music, XP, stats, settings)
- Complete Component Reference
- Discord Activity Gotchas & Solutions
- Code Examples & Workflows

### 🔐 [Authentication & Security](docs/AUTH.md)
- Authentication System (Supabase Auth + Discord OAuth)
- Security Implementation (RLS, SECURITY DEFINER)
- Common Issues & Solutions

### 🗄️ [Database Reference](docs/DATABASE.md)
- Database Schema (users, completed_pomodoros)
- API & RPC Functions
- Complete Utility Functions Reference
- Database RPC Functions (10+ RPCs with security notes)

### 🛠️ [Development & Deployment](docs/DEVELOPMENT.md)
- File Structure
- Environment Variables
- Development Workflow
- Deployment Guide (Vercel + Supabase)

### 🤝 [Contributing Guide](docs/CONTRIBUTING.md)
- Future Enhancements
- How to Contribute
- Support & Resources
- License

---

## Quick Start

```bash
# Clone repo
git clone https://github.com/AchilleasMakris/pomodoro-staging.git
cd pomodoro-staging

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your Supabase + Discord credentials

# Start dev server
npm run dev

# Start Supabase local (optional)
supabase start
```

See **[Development & Deployment](docs/DEVELOPMENT.md)** for detailed setup instructions.

---

## Version History

**Last Updated**: 2025-11-22
**Version**: 2.3.3 (Role System + UI Improvements)

**Major Changes in 2.3.3**:
- **Added**: Role/Path system (Human vs Elf) with buff mechanics
  - Human: 25% chance for 2x XP (risk/reward)
  - Elf: +0.5 XP/min consistency bonus + streak bonuses
  - Buffs stack multiplicatively with pomodoro boost (25%)
  - Segmented toggle UI for path selection (desktop + mobile)
- **Added**: User Stats modal/popover showing detailed account info
  - Separate mobile (modal) and desktop (popover) components
  - 2-column grid layout on mobile
  - Stats: level, path, pomodoros, study time, streaks, Discord avatar
- **Added**: Buff system with tooltips
  - 4 new SVG buff icons (boost, elf-slingshot, elf, human)
  - Mobile: tap to toggle tooltips, tap outside to close
  - Desktop: hover tooltips with viewport boundary checks
  - Portal rendering to prevent clipping
- **Added**: Settings redesign
  - Dual-pattern popover/modal for desktop/mobile
  - "What's New" as 6th tab
  - Progress tab redesign matching user stats style
- **Enhanced**: Level UI improvements
  - XP progress bar with glow wave animation
  - Realistic paper confetti on level up
  - Username truncation with ellipsis
  - Mobile layout optimizations
- **Fixed**: UserStatsPopover clipping - moved outside overflow-hidden container
- **Fixed**: Mobile webkit border-radius flickering on buff icons
- **Fixed**: Double XP save bug - removed duplicate database call
- **Fixed**: OAuth redirect issues for local IP development

**Major Changes in 2.3.2**:
- **Fixed**: Daily gifts trigger on every refresh for Discord Activity users
  - Root cause: `claim_daily_gift()` RPC only validated web users via `auth.uid()`
  - Discord users authenticate via `discord_id`, causing auth errors → frontend marked as claimed locally → server never recorded
  - Solution: Added dual-auth RPC functions (`claim_daily_gift_discord`, `can_claim_daily_gift_discord`)
  - Updated `claimDailyGift()` to detect auth mode and call correct RPC
  - Files: `20250119000000_add_discord_daily_gift_claim.sql`, `userSyncAuth.ts`, `DailyGiftGrid.tsx`

**Previous Versions**:
- **2.3.1** (2025-11-19): localStorage check before server claim (partial fix for web users)
- **2.3.0** (2025-11-18): Split PROJECT.md into 6 modular docs for better navigation
- **2.2.0** (2025-11-18): Added missing sections (Utility Functions, RPC Functions, Migration History)
- **2.1.0** (2025-01-18): Comprehensive documentation update (3,200 → 4,350 lines)
- **2.0.0** (2025-01-10): Initial comprehensive documentation

---

## License

[Your License Here]
