#!/bin/bash

# Full Production Restore Script
# This script:
# 1. Restores Dev database (schema + functions + everything)
# 2. Clears Dev user data
# 3. Restores Production user data
# 4. Repairs auth links

DB_URL="$1"
DEV_BACKUP="supabase/backups/dev_backup_manual-NOW.sql"
PROD_DATA="data-2025-12-02-18-24-09.sql"

if [ -z "$DB_URL" ]; then
  echo "Usage: ./full_restore.sh '<YOUR_PROD_DB_URL>'"
  exit 1
fi

echo "========================================="
echo "STEP 1: Restoring Development Database"
echo "========================================="
psql "$DB_URL" < "$DEV_BACKUP"

echo ""
echo "========================================="
echo "STEP 2: Clearing Development User Data"
echo "========================================="
psql "$DB_URL" << 'EOF'
BEGIN;
TRUNCATE TABLE IF EXISTS public.users CASCADE;
TRUNCATE TABLE IF EXISTS public.chat_messages CASCADE;
TRUNCATE TABLE IF EXISTS public.chat_reports CASCADE;
TRUNCATE TABLE IF EXISTS public.chat_bans CASCADE;
TRUNCATE TABLE IF EXISTS public.completed_pomodoros CASCADE;
TRUNCATE TABLE IF EXISTS public.user_unlocked_rewards CASCADE;
TRUNCATE TABLE IF EXISTS public.completed_breaks CASCADE;
TRUNCATE TABLE IF EXISTS public.system_settings CASCADE;
TRUNCATE TABLE IF EXISTS auth.users CASCADE;
COMMIT;
EOF

echo ""
echo "========================================="
echo "STEP 3: Restoring Production User Data"
echo "========================================="
(
  echo "SET session_replication_role = replica;"
  cat "$PROD_DATA" | \
  sed -E 's/^ALTER TABLE .* DISABLE TRIGGER ALL;/-- &/' | \
  sed -E 's/^ALTER TABLE .* ENABLE TRIGGER ALL;/-- &/'
) | psql "$DB_URL"

echo ""
echo "========================================="
echo "STEP 4: Repairing Auth Links"
echo "========================================="
psql "$DB_URL" << 'EOF'
DO $$
DECLARE
    v_rows_updated integer;
BEGIN
    UPDATE public.users pu
    SET auth_user_id = au.id,
        updated_at = NOW()
    FROM auth.users au
    WHERE 
        (
            (au.raw_user_meta_data->>'discord_id')::text = pu.discord_id
            OR
            (au.raw_user_meta_data->>'provider_id')::text = pu.discord_id
            OR
            (au.raw_user_meta_data->>'sub')::text = pu.discord_id
        )
        AND (pu.auth_user_id IS NULL OR pu.auth_user_id != au.id);

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RAISE NOTICE 'Repaired % user accounts.', v_rows_updated;
END $$;
EOF

echo ""
echo "========================================="
echo "DONE! Production database restored."
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Deploy edge function: supabase functions deploy report-message --project-ref btjhclvebbtjxmdnprwz"
echo "2. Verify in Discord Activity"
