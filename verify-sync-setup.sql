-- ============================================================================
-- VERIFICATION SCRIPT: Cross-Device Sync Setup
-- Run this in Supabase SQL Editor to verify everything is configured correctly
-- ============================================================================

-- 1. CHECK: New columns exist
-- Expected: 2 rows returned
SELECT
  'Column Check' as test_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('total_login_days', 'last_pomodoro_date')
ORDER BY column_name;

-- 2. CHECK: Level constraint updated (should allow 1-50)
-- Expected: Shows constraint allows level between 1 and 50
SELECT
  'Level Constraint' as test_name,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND conname LIKE '%level%';

-- 3. CHECK: RPC function exists with all parameters
-- Expected: Should show all 29+ parameters including new ones
SELECT
  'RPC Function Parameters' as test_name,
  parameter_name,
  data_type,
  ordinal_position
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'update_user_preferences'
ORDER BY ordinal_position;

-- 4. CHECK: Count of parameters (should be ~30 including p_user_id)
SELECT
  'Total Parameters Count' as test_name,
  COUNT(*) as parameter_count,
  CASE
    WHEN COUNT(*) >= 30 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing parameters'
  END as status
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'update_user_preferences';

-- 5. CHECK: Verify specific new parameters exist
SELECT
  'New Parameters Check' as test_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.parameters
      WHERE routine_name = 'update_user_preferences'
      AND parameter_name = 'p_xp'
    ) THEN '✓ p_xp exists'
    ELSE '✗ p_xp MISSING'
  END as xp_param,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.parameters
      WHERE routine_name = 'update_user_preferences'
      AND parameter_name = 'p_total_login_days'
    ) THEN '✓ p_total_login_days exists'
    ELSE '✗ p_total_login_days MISSING'
  END as login_days_param,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.parameters
      WHERE routine_name = 'update_user_preferences'
      AND parameter_name = 'p_last_pomodoro_date'
    ) THEN '✓ p_last_pomodoro_date exists'
    ELSE '✗ p_last_pomodoro_date MISSING'
  END as pomodoro_date_param;

-- 6. CHECK: Sample user data structure
-- Expected: Shows columns with sample data (if you have users)
SELECT
  'Sample User Data' as test_name,
  id,
  username,
  level,
  xp,
  prestige_level,
  total_pomodoros,
  total_study_minutes,
  total_login_days,
  consecutive_login_days,
  timer_pomodoro_minutes,
  auto_start_breaks,
  background_id,
  updated_at
FROM users
ORDER BY updated_at DESC
LIMIT 1;

-- 7. CHECK: RLS policies exist
SELECT
  'RLS Policies Check' as test_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- ============================================================================
-- INTERPRETATION OF RESULTS
-- ============================================================================

/*
EXPECTED RESULTS:

1. Column Check:
   - Should show 2 rows: total_login_days (integer), last_pomodoro_date (text)
   - If 0 rows: Migration NOT applied - run migration!

2. Level Constraint:
   - Should show: CHECK (level >= 1 AND level <= 50)
   - If shows 1-20: Old constraint - run migration!

3. RPC Function Parameters:
   - Should show ~30 parameters
   - Must include: p_xp, p_level, p_prestige_level, p_total_login_days, etc.
   - If missing: Migration NOT applied or function not created

4. Total Parameters Count:
   - Should show: ✓ PASS with count >= 30
   - If ✗ FAIL: Function not updated - run migration!

5. New Parameters Check:
   - All three should show ✓
   - If any show ✗: Function missing parameters - run migration!

6. Sample User Data:
   - If you have users, should show their data with all columns
   - Check that new columns have values (not NULL)
   - If columns missing: Migration NOT applied

7. RLS Policies:
   - Should show policies like "Users can view own profile"
   - Ensures data security is enabled

NEXT STEPS:
- If ALL checks pass ✓: You're ready to test!
- If ANY check fails ✗: Run the migration file first
- After fixing, re-run this verification script
*/

-- ============================================================================
-- QUICK FIX: If migration not applied
-- ============================================================================

/*
Run this to apply migration:

Option 1 - Supabase CLI:
  supabase db push

Option 2 - Manual:
  1. Open: supabase/migrations/20251113_add_full_cross_device_sync.sql
  2. Copy all contents
  3. Paste here and run
*/
