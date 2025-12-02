# Database Migration Guide: Dev → Production

## Overview
This guide explains how to safely merge database schema changes from the development branch to production when merging a pull request.

---

## Prerequisites

- Access to Supabase Dashboard (both dev and production projects)
- Access to GitHub repository
- Supabase CLI installed (optional, but recommended)

---

## Option 1: Using Supabase Dashboard (Recommended for Small Changes)

### Step 1: Review Pending Migrations
1. Navigate to the **dev branch** Supabase project
2. Go to **SQL Editor** → **Migrations** tab
3. Review all migration files that need to be applied to production
4. Note any migrations that were already applied manually

### Step 2: Export Schema Diff
1. In Supabase Dashboard (dev project):
   - Go to **Database** → **Tables**
   - Click **Generate Types** or **Schema Diff** (if available)
2. Compare with production database schema

### Step 3: Apply Migrations to Production
**Method A: Copy Migration Files**
1. Open Supabase Dashboard for **production project**
2. Go to **SQL Editor**
3. Copy migration SQL files from `supabase/migrations/` folder (in order by timestamp)
4. Run each migration one by one in production SQL Editor
5. Verify each migration succeeds before continuing

**Method B: Manual Schema Replication**
1. For each table/function change:
   - Open dev project → **Database** → **Tables/Functions**
   - Copy SQL definition
   - Open production project → **SQL Editor**
   - Paste and run SQL

### Step 4: Verify Production Schema
1. In production Supabase Dashboard:
   - Go to **Database** → **Tables**
   - Verify all new tables exist
   - Check columns match dev schema
2. Test database functions:
   - Run `SELECT * FROM pg_proc WHERE proname LIKE '%your_function%'`
   - Verify functions are present

---

## Option 2: Using Supabase CLI (Recommended for Large Changes)

### Step 1: Install Supabase CLI
```bash
# macOS
brew install supabase/tap/supabase

# or npm
npm install -g supabase
```

### Step 2: Link to Production Project
```bash
# Get your production project ref from Supabase Dashboard
# Project Settings → General → Project ID

cd /Users/lex/Documents/Code/pomodoro-staging
supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF
```

### Step 3: Push Migrations to Production
```bash
# Dry run first (see what will be applied)
supabase db push --dry-run

# Apply migrations to production
supabase db push
```

### Step 4: Verify Deployment
```bash
# Check migration history
supabase migration list --remote

# Verify schema
supabase db diff --schema public
```

---

## Migration Files to Apply (Current Branch)

Based on recent migrations in `supabase/migrations/`, here are the key files to apply:

### Chat System
- `20251125030800_create_chat_tables.sql` - Chat messages, reports, bans
- `20251125040000_add_system_settings.sql` - Chat enable/disable
- `20251125050000_add_chat_moderation.sql` - Moderation tools
- `20251129160000_secure_chat_messages.sql` - RLS policies
- `20251130000000_chat_reports.sql` - Report system
- `20251130010000_auto_delete_banned_messages.sql` - Auto-cleanup
- `20251130020000_hide_deleted_messages.sql` - Soft delete
- `20251130030000_fix_chat_delete_policy.sql` - Delete permissions
- `20251130040000_enable_realtime_deletes.sql` - Realtime sync
- `20251202175800_update_chat_length.sql` - Message length limit

### User System & Buffs
- `20251121000000_add_role_buffs.sql` - Role-based buffs
- `20251121000001_update_daily_gift_for_buffs.sql` - Daily gift buffs
- `20251122000000_add_boost_columns.sql` - Boost multipliers
- `20251124000000_add_boost_multiplier_support.sql` - Enhanced boosts
- `20251203000000_add_discord_buff_functions.sql` - Discord role sync

### Progress Tracking
- `20250119100000_add_completed_breaks_table.sql` - Break tracking
- `20250119110000_add_atomic_save_break_functions.sql` - Break functions
- `20251129000000_add_prestige_stars.sql` - Prestige system
- `20251119_auto_calculate_level_prestige.sql` - Auto-leveling

### Daily Gifts
- `20250118000000_add_daily_gift_tracking.sql` - Gift system
- `20251119_secure_daily_gift_claim.sql` - Secure claiming
- `20250119000000_add_discord_daily_gift_claim.sql` - Discord integration

---

## Critical Functions to Verify

After applying migrations, verify these critical functions exist in production:

### Pomodoro Functions
```sql
SELECT proname FROM pg_proc WHERE proname LIKE 'atomic_save_pomodoro%';
```
Expected: `atomic_save_pomodoro`

### Break Functions
```sql
SELECT proname FROM pg_proc WHERE proname LIKE 'atomic_save%break%';
```
Expected: `atomic_save_short_break`, `atomic_save_long_break`

### User Functions
```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%handle_new_user%';
```
Expected: `handle_new_user`

### Chat Functions
```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%chat%';
```
Expected: Chat moderation and report functions

### Buff Functions
```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%buff%';
```
Expected: `claim_discord_buff`, `get_active_buffs`, etc.

---

## RLS Policy Verification

Ensure Row Level Security (RLS) is enabled on all tables:

```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Should return 'true' for all tables
```

### Critical Tables with RLS
- `users` - User data protection
- `chat_messages` - Message visibility
- `chat_reports` - Report privacy
- `banned_users` - Ban management
- `completed_breaks` - User break history
- `completed_pomodoros` - User pomodoro history

---

## Data Migration (Optional)

If you need to migrate data from dev to production:

### Export from Dev
```sql
-- Export specific table data
COPY users TO '/tmp/users.csv' WITH CSV HEADER;
COPY chat_messages TO '/tmp/messages.csv' WITH CSV HEADER;
```

### Import to Production
```sql
-- Import data
COPY users FROM '/tmp/users.csv' WITH CSV HEADER;
COPY chat_messages FROM '/tmp/messages.csv' WITH CSV HEADER;
```

**⚠️ WARNING:** Only migrate data if absolutely necessary. Production data should remain separate.

---

## Rollback Plan

If something goes wrong:

### Immediate Rollback
1. Revert the PR merge on GitHub
2. Redeploy previous production version
3. Restore database from Supabase automatic backup:
   - Go to **Database** → **Backups**
   - Select backup before migration
   - Click **Restore**

### Manual Rollback SQL
Keep these commands ready before migrating:

```sql
-- Drop new tables
DROP TABLE IF EXISTS completed_breaks CASCADE;
DROP TABLE IF EXISTS chat_reports CASCADE;

-- Drop new functions
DROP FUNCTION IF EXISTS atomic_save_short_break CASCADE;
DROP FUNCTION IF EXISTS claim_discord_buff CASCADE;

-- Revert column additions
ALTER TABLE users DROP COLUMN IF EXISTS pomodoro_boost_active;
ALTER TABLE users DROP COLUMN IF EXISTS prestige_stars;
```

---

## Testing Checklist

After applying migrations to production:

### Database Tests
- [ ] All migrations applied successfully (no errors)
- [ ] All tables exist with correct columns
- [ ] All functions are present and callable
- [ ] RLS policies are active and correct
- [ ] Foreign keys and constraints work

### Application Tests
- [ ] User authentication works
- [ ] Pomodoro timer saves correctly
- [ ] Break tracking saves
- [ ] Chat messages send/receive
- [ ] Daily gift claiming works
- [ ] Buff system active
- [ ] Leaderboard displays
- [ ] Level progression correct

### Discord Activity Tests
- [ ] OAuth login works
- [ ] Discord username syncs
- [ ] Role buffs apply
- [ ] Chat works in embedded frame

---

## Common Issues & Solutions

### Issue: Migration Order Error
**Error:** `relation "table_name" does not exist`
**Solution:** Migrations must be applied in chronological order. Check timestamps.

### Issue: Function Already Exists
**Error:** `function "func_name" already exists`
**Solution:** Use `CREATE OR REPLACE FUNCTION` instead of `CREATE FUNCTION`

### Issue: RLS Blocks Everything
**Error:** `new row violates row-level security policy`
**Solution:** Check service role key is used in backend, anon key for frontend

### Issue: Realtime Not Working
**Error:** No realtime updates after migration
**Solution:**
```sql
-- Enable realtime on table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
```

---

## Post-Merge Monitoring

### First 24 Hours
- [ ] Monitor Sentry for errors
- [ ] Check Supabase logs for query errors
- [ ] Verify user activity metrics
- [ ] Test chat system load

### Week 1
- [ ] Review database performance
- [ ] Check for missing indexes
- [ ] Verify backup schedules
- [ ] Monitor storage usage

---

## Emergency Contacts

- **Database Issues:** Check Supabase Status (status.supabase.com)
- **Application Errors:** Check Sentry dashboard
- **Rollback Required:** Follow "Rollback Plan" above immediately

---

## Notes

- Always test migrations in a **staging environment** before production
- Keep a backup of production database before major migrations
- Coordinate deployment with low-traffic periods if possible
- Document any manual schema changes not covered by migration files

---

## Quick Reference Commands

```bash
# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Apply all migrations
supabase db push

# Check migration status
supabase migration list --remote

# Generate new migration
supabase migration new migration_name

# Reset local database
supabase db reset

# Pull remote schema
supabase db pull
```

---

## Success Criteria

Migration is considered successful when:
1. ✅ All migration files applied without errors
2. ✅ Schema matches dev environment
3. ✅ All functions callable and working
4. ✅ RLS policies protecting data correctly
5. ✅ Application tests pass
6. ✅ No errors in production logs for 1 hour
7. ✅ User activity continues normally
