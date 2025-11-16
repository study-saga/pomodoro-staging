# Apply Migration to Supabase

## Option 1: Using Supabase CLI (Recommended)

```bash
# Push migration to your Supabase project
supabase db push
```

## Option 2: Using Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Open the migration file: supabase/migrations/20251113_add_full_cross_device_sync.sql
3. Copy all contents
4. Paste into SQL Editor
5. Click "Run"

## Verify Migration Applied

Run this query in Supabase SQL Editor:

```sql
-- Check if new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('total_login_days', 'last_pomodoro_date');

-- Should return 2 rows showing these columns exist
```

## Check RPC Function

```sql
-- Verify update_user_preferences accepts new parameters
SELECT 
  routine_name,
  array_agg(parameter_name ORDER BY ordinal_position) as parameters
FROM information_schema.parameters
WHERE specific_schema = 'public' 
  AND routine_name = 'update_user_preferences'
GROUP BY routine_name;
```

Should show parameters including:
- p_xp
- p_level
- p_prestige_level
- p_total_login_days
- etc.
