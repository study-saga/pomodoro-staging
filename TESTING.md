# Cross-Device Sync Testing Guide

Complete guide to test that all user data syncs correctly across devices.

---

## Prerequisites

### 1. Apply Database Migration

**CRITICAL**: You must apply the migration first or the app will crash!

```bash
# Navigate to project root
cd /path/to/pomodoro-staging

# Push migration to Supabase
supabase db push
```

Or manually via Supabase Dashboard:
1. Go to SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copy contents of `supabase/migrations/20251113_add_full_cross_device_sync.sql`
3. Paste and run

### 2. Verify Migration

Run this in Supabase SQL Editor:

```sql
-- Check new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('total_login_days', 'last_pomodoro_date');

-- Should return 2 rows
```

### 3. Start Dev Server

```bash
npm run dev
```

---

## Test Scenario 1: Single Device - Data Persists

**Goal**: Verify data saves to database and reloads correctly.

### Steps:

1. **Open app in browser** (e.g., Chrome)
   - Login with Discord
   - Wait for "Loaded from database and captured store state" in console

2. **Check initial state**
   ```
   Open DevTools Console (F12)
   Look for: [Settings Sync] Loading ALL user data from database
   ```

3. **Make changes:**
   - Complete a 1-minute pomodoro (for quick testing)
   - Change timer to 30 minutes
   - Enable "Auto-start breaks"
   - Change background video
   - Note your current XP and level

4. **Wait for auto-sync**
   ```
   Watch console for:
   [Settings Sync] Settings changed - marked dirty
   [Settings Sync] Changed fields: timer_pomodoro_minutes: 25 → 30, ...

   Then after 2 minutes OR when you switch tabs:
   [Settings Sync] Syncing to database (reason: visibility change)
   [Settings Sync] ✓ Synced successfully
   ```

5. **Force sync by switching tabs**
   - Switch to another tab/window
   - Switch back
   - Should see "Synced successfully" in console

6. **Verify in database**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT
     username,
     level,
     xp,
     total_pomodoros,
     timer_pomodoro_minutes,
     auto_start_breaks,
     background_id,
     updated_at
   FROM users
   WHERE discord_id = 'YOUR_DISCORD_ID'
   ORDER BY updated_at DESC
   LIMIT 1;
   ```
   Should show your changes!

7. **Hard refresh** (Ctrl+Shift+R or Cmd+Shift+R)
   - All settings should persist
   - XP and level should be same
   - Timer duration should be 30 minutes
   - Auto-start should still be enabled

### ✅ Pass Criteria:
- Console shows "Loaded from database"
- Changes save to database
- Hard refresh loads same data
- No errors in console

---

## Test Scenario 2: Multi-Device Sync

**Goal**: Verify data syncs across different browsers/devices.

### Setup:

**Device A**: Chrome (or your primary browser)
**Device B**: Firefox/Safari/Incognito Chrome (or actual phone/tablet)

### Steps:

#### On Device A:

1. **Login and note starting values**
   ```
   Open console and check:
   - Level: _____
   - XP: _____
   - Total Pomodoros: _____
   - Timer Duration: _____
   ```

2. **Make specific changes:**
   - Change pomodoro timer to **45 minutes**
   - Change short break to **10 minutes**
   - Enable **auto-start breaks** ✓
   - Enable **auto-start pomodoros** ✓
   - Change background to a specific video (note which one)
   - Change username to "TestUser123"

3. **Complete a pomodoro session**
   - Start 1-minute timer (for quick test)
   - Let it complete
   - Note new XP value in console
   - Note new level (if it changed)

4. **Force sync**
   - Switch to another tab
   - Switch back
   - Wait for "✓ Synced successfully"

5. **Verify sync happened**
   ```
   Console should show:
   [Settings Sync] Changed fields: timer_pomodoro_minutes: 25 → 45, ...
   [Settings Sync] Syncing to database (reason: visibility change)
   [Settings Sync] ✓ Synced successfully
   ```

#### On Device B:

6. **Login from different browser/device**
   - Open app in Firefox/Incognito/Phone
   - Login with same Discord account
   - Wait for "Loading ALL user data from database"

7. **Verify ALL data synced:**
   ```
   Check in UI and console:
   ✓ Timer duration: 45 minutes (not default 25)
   ✓ Short break: 10 minutes (not default 5)
   ✓ Auto-start breaks: ENABLED
   ✓ Auto-start pomodoros: ENABLED
   ✓ Background: SAME video as Device A
   ✓ Username: "TestUser123"
   ✓ Level: SAME as Device A
   ✓ XP: SAME as Device A (including the pomodoro you completed)
   ✓ Total Pomodoros: SAME as Device A
   ```

8. **Make changes on Device B:**
   - Change timer to **50 minutes**
   - Disable auto-start breaks
   - Change background to different video
   - Complete another pomodoro (1 min for testing)

9. **Force sync on Device B**
   - Switch tabs
   - Wait for "✓ Synced successfully"

#### Back to Device A:

10. **Refresh Device A**
    - Hard refresh (Ctrl+Shift+R)
    - Wait for "Loading ALL user data from database"

11. **Verify reverse sync:**
    ```
    ✓ Timer duration: 50 minutes (updated from Device B)
    ✓ Auto-start breaks: DISABLED (updated from Device B)
    ✓ Background: NEW video from Device B
    ✓ Total Pomodoros: +1 (from Device B pomodoro)
    ✓ XP: Increased from Device B pomodoro
    ✓ Level: May have increased if XP crossed threshold
    ```

### ✅ Pass Criteria:
- All 29 fields sync from Device A → Device B
- All 29 fields sync from Device B → Device A
- XP, levels, stats are identical
- No data loss
- No console errors

---

## Test Scenario 3: Level System Sync

**Goal**: Verify level progression syncs correctly.

### Steps:

1. **Device A - Start at low level**
   - Note starting level and XP
   - Example: Level 3, XP 500

2. **Complete multiple pomodoros**
   - Use 1-minute timer for quick testing
   - Complete 5 pomodoros
   - Watch XP increase in real-time
   - May level up (each level requires 100 * level² XP)

3. **Force sync**
   - Switch tabs to trigger sync
   - Verify console: "Synced successfully"

4. **Device B - Verify level sync**
   - Refresh or login on Device B
   - Should see EXACT same level and XP
   - Console should show:
     ```
     [Settings Sync] Loading ALL user data from database
     ```

5. **Test prestige (if applicable)**
   - If you have a Level 50 account, trigger prestige
   - Force sync
   - Device B should show prestige_level increased

### ✅ Pass Criteria:
- XP syncs correctly (10 XP per minute)
- Level syncs correctly
- Prestige syncs correctly
- Stats (total_pomodoros, total_study_minutes) sync

---

## Test Scenario 4: Login Streak Sync

**Goal**: Verify login tracking syncs.

### Steps:

1. **Check current streak**
   ```sql
   -- Supabase SQL Editor
   SELECT
     consecutive_login_days,
     total_login_days,
     last_login_date
   FROM users
   WHERE discord_id = 'YOUR_DISCORD_ID';
   ```

2. **Login from Device A**
   - Note the streak in database

3. **Login from Device B (same day)**
   - Streak should be SAME (not increment twice in one day)

4. **Manually test next-day login** (optional)
   ```sql
   -- TESTING ONLY - Manually set last login to yesterday
   UPDATE users
   SET last_login_date = CURRENT_DATE - INTERVAL '1 day'
   WHERE discord_id = 'YOUR_DISCORD_ID';
   ```

5. **Refresh app**
   - Should increment consecutive_login_days by 1
   - Should increment total_login_days by 1
   - Verify syncs to both devices

### ✅ Pass Criteria:
- Login streak increments correctly
- Doesn't double-count same day
- Syncs to all devices

---

## Test Scenario 5: Auto-Start Timers

**Goal**: Verify auto-start settings work and sync.

### Steps:

1. **Device A - Configure auto-start**
   - Set pomodoro timer: 1 minute
   - Set short break: 1 minute
   - Enable "Auto-start breaks"
   - Enable "Auto-start pomodoros"
   - Force sync

2. **Device B - Verify settings synced**
   - Refresh Device B
   - Both checkboxes should be checked
   - Timer durations should match

3. **Device B - Test auto-start**
   - Start a 1-minute pomodoro
   - Let it complete (wait for bell sound)
   - Timer should AUTOMATICALLY switch to "Short Break" and START counting down
   - Console should show:
     ```
     [Timer] Auto-start breaks ENABLED → starting break automatically
     [Timer] Switching to shortBreak, autoStart=true
     [Timer] Timer started for shortBreak
     ```

4. **Let break complete**
   - Should AUTOMATICALLY switch back to "Pomodoro" and start
   - Console should show:
     ```
     [Timer] Auto-start pomodoros ENABLED → starting pomodoro automatically
     [Timer] Switching to pomodoro, autoStart=true
     [Timer] Timer started for pomodoro
     ```

5. **Disable on Device B**
   - Uncheck both auto-start options
   - Force sync

6. **Device A - Verify sync**
   - Refresh Device A
   - Both checkboxes should be UNCHECKED
   - Complete a timer → should NOT auto-start next

### ✅ Pass Criteria:
- Auto-start settings sync both ways
- Auto-start functionality works when enabled
- Timers do NOT auto-start when disabled
- Console shows correct behavior

---

## Test Scenario 6: Page Unload Sync

**Goal**: Verify data saves even when closing app quickly.

### Steps:

1. **Device A - Make quick changes**
   - Change timer to 35 minutes
   - Change background
   - Enable a setting

2. **Immediately close tab** (don't wait for sync)
   - Close browser tab right away
   - The keepalive fetch should save data even while closing

3. **Device B - Verify saved**
   - Open app on Device B
   - Should see timer at 35 minutes
   - Should see new background
   - Should see setting enabled

### ✅ Pass Criteria:
- Data saves even with immediate tab close
- No data loss

---

## Debugging: What to Check If Things Don't Work

### 1. Check Console Logs

Look for these key messages:

**On Load:**
```
[Settings Sync] Loading ALL user data from database (one-time)
[Settings Sync] ✓ Loaded from database and captured store state
```

**On Change:**
```
[Settings Sync] Settings changed - marked dirty (will sync on trigger)
[Settings Sync] Changed fields: xp: 100 → 150, total_pomodoros: 5 → 6
```

**On Sync:**
```
[Settings Sync] Syncing to database (reason: visibility change)
[User Sync] Updating ALL user data for user <uuid>
[Settings Sync] ✓ Synced successfully
```

### 2. Check for Errors

**Migration not applied:**
```
Error: column "total_login_days" does not exist
```
→ Solution: Apply migration!

**RLS policy error:**
```
Error: new row violates row-level security policy
```
→ Solution: Check auth.uid() matches user

**Stale data:**
```
Settings show old values after refresh
```
→ Solution: Check lastSyncedStateRef is updating

### 3. Inspect Database Directly

```sql
-- Check user data
SELECT * FROM users
WHERE discord_id = 'YOUR_DISCORD_ID';

-- Check sync timestamp
SELECT
  username,
  level,
  xp,
  updated_at,
  NOW() - updated_at as time_since_update
FROM users
WHERE discord_id = 'YOUR_DISCORD_ID';

-- Should show recent updated_at if sync working
```

### 4. Check Network Tab

1. Open DevTools → Network tab
2. Filter: `update_user_preferences`
3. Complete a change and sync
4. Should see POST request to `/rest/v1/rpc/update_user_preferences`
5. Click request → Preview → Should show updated user object

### 5. Verify Settings Store

```javascript
// Run in console
const state = window.__POMODORO_SETTINGS_STORE__;
console.log(state);

// Or access directly
console.log(useSettingsStore.getState());
```

Should show all your current settings.

---

## Quick Test Script

Copy-paste this into console to see current state:

```javascript
// Get current settings
const settings = useSettingsStore.getState();

console.log('=== CURRENT USER DATA ===');
console.log('Level:', settings.level);
console.log('XP:', settings.xp);
console.log('Prestige:', settings.prestigeLevel);
console.log('Total Pomodoros:', settings.totalPomodoros);
console.log('Total Study Minutes:', settings.totalStudyMinutes);
console.log('Username:', settings.username);
console.log('Level Path:', settings.levelPath);
console.log('');
console.log('=== TIMER SETTINGS ===');
console.log('Pomodoro:', settings.timers.pomodoro, 'min');
console.log('Short Break:', settings.timers.shortBreak, 'min');
console.log('Long Break:', settings.timers.longBreak, 'min');
console.log('Auto-start Breaks:', settings.autoStartBreaks);
console.log('Auto-start Pomodoros:', settings.autoStartPomodoros);
console.log('');
console.log('=== TRACKING ===');
console.log('Unique Days:', settings.totalUniqueDays);
console.log('Last Pomodoro Date:', settings.lastPomodoroDate);
console.log('Login Streak:', settings.consecutiveLoginDays);
console.log('Total Login Days:', settings.totalLoginDays);
console.log('Last Login:', settings.lastLoginDate);
```

---

## Expected Timeline

**Initial Load**: ~500ms to load from database
**Change Detection**: Instant (marks dirty)
**Auto Sync**: Every 2 minutes OR on tab switch
**Sync Duration**: ~200-500ms for database write
**Cross-Device Propagation**: Instant on next page load

---

## Success Checklist

After testing, you should be able to confirm:

- [ ] Migration applied successfully
- [ ] No console errors
- [ ] Data loads from database on login
- [ ] Changes mark state as "dirty"
- [ ] Sync triggers on tab switch
- [ ] Sync triggers every 2 minutes
- [ ] All 29 fields sync to database
- [ ] Device A → Device B sync works
- [ ] Device B → Device A sync works
- [ ] XP and levels sync correctly
- [ ] Stats (pomodoros, minutes) sync correctly
- [ ] Login streaks sync correctly
- [ ] Auto-start settings sync and work
- [ ] Page unload saves data (keepalive)
- [ ] Hard refresh loads synced data
- [ ] No data loss after closing/reopening

---

## Performance Expectations

**Sync Frequency**: 5-10 syncs per session (was ~100 before optimization)
**Database Writes**: Only when data actually changed
**Network Usage**: Minimal (~2KB per sync)
**No Lag**: Sync happens in background, no UI freeze

---

## Need Help?

If sync isn't working:

1. Check console for errors
2. Verify migration applied
3. Check database manually (SQL queries above)
4. Check Network tab for failed requests
5. Run quick test script (above)
6. Report issue with console logs + error messages
