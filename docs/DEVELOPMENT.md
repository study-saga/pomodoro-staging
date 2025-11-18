# Development & Deployment

Development workflow, environment setup, and deployment guide.

[← Back to Main Documentation](../PROJECT.md)

---

## File Structure

```
pomodoro-staging/
├── public/
│   ├── sounds/               # Sound effect assets
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── PomodoroTimer.tsx       # Main timer component
│   │   ├── StatsDashboard.tsx      # User statistics display
│   │   ├── Settings.tsx            # Settings panel
│   │   ├── LevelSystem.tsx         # XP/level UI
│   │   └── MusicPlayer.tsx         # Background music player
│   ├── contexts/
│   │   ├── AuthContext.tsx         # Auth state management
│   │   └── SettingsContext.tsx     # User settings state
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client initialization
│   │   ├── supabaseAuth.ts         # Auth functions (Discord OAuth)
│   │   ├── userSyncAuth.ts         # User data sync functions
│   │   ├── levelSystem.ts          # Level/XP calculation logic
│   │   └── discordSdk.ts           # Discord Embedded App SDK setup
│   ├── types/
│   │   └── index.ts                # TypeScript type definitions
│   ├── App.tsx                     # Root component
│   ├── main.tsx                    # App entry point
│   └── index.css                   # Global styles (Tailwind)
├── supabase/
│   ├── functions/
│   │   ├── discord-token/
│   │   │   └── index.ts            # OAuth token exchange function
│   │   └── _shared/
│   │       └── cors.ts             # CORS headers
│   ├── migrations/
│   │   ├── 20251110170000_add_supabase_auth_integration.sql
│   │   ├── 20251110171000_update_atomic_functions_for_auth.sql
│   │   ├── 20251110173000_fix_null_auth_user_id_lockout.sql
│   │   └── 20251110174000_atomic_save_pomodoro.sql
│   └── config.toml                 # Supabase configuration
├── .env                            # Environment variables (gitignored)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── PROJECT.md                      # This file
└── README.md
```

### Key Files Explained

#### `src/lib/supabaseAuth.ts`
Central authentication module. Handles:
- Discord OAuth initiation
- Session management
- User profile fetching/creation
- Legacy account migration (backfill)

**Key Functions**:
- `authenticateWithSupabase()` - Main auth entry point
- `signInWithDiscord()` - Initiates OAuth flow
- `fetchOrCreateAppUser()` - Gets/creates user profile
- `getAvatarUrl()` - Generates Discord avatar URLs

#### `src/lib/userSyncAuth.ts`
User data synchronization functions. Handles:
- Fetching user stats
- Saving completed pomodoros
- Updating user settings
- XP/level calculations

**Key Functions**:
- `getUserStats()` - Fetches user statistics
- `saveCompletedPomodoro()` - Saves pomodoro (calls RPC)
- `updateUserSettings()` - Updates user preferences

#### `src/lib/levelSystem.ts`
Level and XP calculation logic.

**Key Functions**:
- `calculateLevel()` - Determines level from XP
- `getXpForLevel()` - Calculates XP required for level
- `getXpProgress()` - Calculates % progress to next level
- `calculateXpEarned()` - XP earned for session (10 XP/min)

**Formula**: `XP for level N = 100 * N²`

Example:
- Level 1: 100 XP
- Level 2: 400 XP (cumulative: 500 XP)
- Level 3: 900 XP (cumulative: 1,400 XP)

#### `src/components/PomodoroTimer.tsx`
Main timer component. Features:
- Countdown timer with visual progress
- Start/pause/reset controls
- Duration selection
- Task name input
- Completion handling (saves to DB)
- Sound effects

#### `src/contexts/AuthContext.tsx`
Auth state management via React Context.

**Provides**:
- `user`: Current authenticated user
- `session`: Supabase session
- `appUser`: User profile data
- `loading`: Auth loading state
- `signOut()`: Sign out function

---

## Environment Variables

### Frontend (.env)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: Discord Application ID (for SDK)
VITE_DISCORD_CLIENT_ID=your_discord_client_id
```

### Edge Functions (Supabase Secrets)

Set via Supabase CLI:

```bash
# Production Discord OAuth
supabase secrets set DISCORD_CLIENT_ID="your_production_client_id"
supabase secrets set DISCORD_CLIENT_SECRET="your_production_secret"

# Staging Discord OAuth (optional)
supabase secrets set DISCORD_CLIENT_ID_STAGING="your_staging_client_id"
supabase secrets set DISCORD_CLIENT_SECRET_STAGING="your_staging_secret"
```

**Access in Edge Functions**:
```typescript
const clientId = Deno.env.get('DISCORD_CLIENT_ID')
const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')
```

---

## Development Workflow

### Initial Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd pomodoro-staging

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Link to Supabase project (if using Supabase CLI)
supabase link --project-ref your-project-ref

# 5. Run migrations (if needed)
supabase db push

# 6. Start development server
npm run dev
```

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Lint code
npm run lint

# Format code
npm run format
```

### Supabase CLI Commands

```bash
# Link to project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Create new migration
supabase migration new migration_name

# Deploy edge function
supabase functions deploy discord-token --no-verify-jwt

# Set edge function secrets
supabase secrets set KEY=value

# View logs
supabase functions logs discord-token

# Generate TypeScript types from database
supabase gen types typescript --local > src/types/database.ts
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes, commit frequently
git add .
git commit -m "feat: add feature description"

# Push to remote
git push origin feature/your-feature-name

# After review, merge to main
git checkout main
git merge feature/your-feature-name
git push origin main
```

### Testing Discord Activity Locally

1. **Enable HTTPS locally** (Discord requires HTTPS):
   ```bash
   # Use ngrok or similar
   ngrok http 5173
   ```

2. **Update Discord Activity URL**:
   - Go to Discord Developer Portal
   - Update Activity URL to your ngrok URL

3. **Test in Discord**:
   - Open Discord
   - Start your Activity from Activities menu
   - Should see app in iframe

---

## Deployment

### Frontend (Vercel)

1. **Connect Repository**:
   - Import project from GitHub in Vercel dashboard
   - Select `main` branch for production

2. **Configure Environment Variables**:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Build Settings**:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Deploy**:
   - Push to `main` branch triggers automatic deployment
   - Or manually deploy from Vercel dashboard

### Backend (Supabase)

#### Database Migrations

```bash
# Push local migrations to production
supabase db push --db-url "postgresql://..."

# Or run in Supabase Dashboard SQL Editor
# Copy migration SQL and execute
```

#### Edge Functions

```bash
# Deploy discord-token function
supabase functions deploy discord-token --no-verify-jwt --project-ref your-project-ref

# Verify deployment
curl https://your-project.supabase.co/functions/v1/discord-token
```

#### Secrets Management

```bash
# Set production secrets
supabase secrets set DISCORD_CLIENT_ID="..." --project-ref your-project-ref
supabase secrets set DISCORD_CLIENT_SECRET="..." --project-ref your-project-ref

# List secrets
supabase secrets list --project-ref your-project-ref
```

### Discord Application Setup

1. **Update OAuth2 Redirect URLs**:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```

2. **Update Activity URL**:
   ```
   https://your-vercel-app.vercel.app
   ```

3. **Verify Activity Settings**:
   - HTTPS enabled
   - Proper scopes (`identify guilds`)
   - Age rating configured

### Post-Deployment Checklist

- [ ] Frontend deployed successfully
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] Secrets configured
- [ ] Discord OAuth redirect URLs updated
- [ ] Discord Activity URL updated
- [ ] Test authentication flow in Discord
- [ ] Test pomodoro session completion
- [ ] Verify stats are updating
- [ ] Check error logs in Supabase

---
