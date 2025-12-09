1) In src/components/settings/SettingsPopover.tsx around lines 489 to 492, the
button is made visually hidden via opacity: 0 and pointer-events-none when
autoHideUI is active but remains focusable; update the element to remove it from
keyboard and accessibility flow when hidden by conditionally adding
tabIndex={-1} (and/or aria-hidden="true") when (!isMouseActive && autoHideUI)
and ensure you restore tabIndex (or remove aria-hidden) when visible so keyboard
users aren’t trapped on an invisible control.

2)In src/components/settings/TimezoneTab.tsx around lines 152 to 163, the JSX uses
a non-null assertion pendingTimezoneAppliesAt! which is unsafe if state becomes
inconsistent; update the conditional to also check pendingTimezoneAppliesAt is
defined before rendering the "Applies" line (or render a safe fallback string
like "TBD"), and use a guarded expression to call new Date(...) only when
pendingTimezoneAppliesAt is present to avoid runtime exceptions.

3) In src/components/timer/PomodoroTimer.tsx around lines 149 to 155, calling
audioRef.current.load() alone won't reliably unlock audio on iOS Safari; replace
or supplement it with a user-initiated play/pause or audioCtx.resume() call to
unlock playback (e.g., call audioRef.current.play().then(() =>
audioRef.current.pause()).catch(() => {})), ensuring this runs inside the user
gesture when soundEnabled is true; also remove the duplicated "// Play
completion sound" comment found around lines 283-284 so there is only one
descriptive comment.

4)In src/contexts/ChatContext.tsx around lines 787 to 792, manualRetry only sets
connectionState and retryCount but does not actually initiate a reconnection;
update manualRetry to trigger the real connection logic by either calling the
existing attemptConnection/connect function (ensure that function is stable via
useCallback or a ref) or by updating a dedicated reconnection trigger (e.g.,
increment a retryTrigger state/ref that the connection effect depends on) so the
connection effect runs and a real reconnect is attempted.

5)Year rollover edge case in monthDay end date calculation.

For a buff like December Festivities (Dec 1-31), if a user checks on January 1st while the buff might still be considered "active" from the previous year's window, the calculation uses currentDate.getFullYear() which would compute an end date in the current year (e.g., Dec 31, 2026) rather than the previous year's actual end (Dec 31, 2025).

This could cause the countdown to show ~364 days instead of "expired".

Consider adding year adjustment logic when the computed end date is significantly in the future relative to currentDate:

+    // If end date is more than 6 months away, it's likely from the previous year's occurrence
+    if (endDate.getTime() - currentDate.getTime() > 180 * 24 * 60 * 60 * 1000) {
+      endDate.setFullYear(endDate.getFullYear() - 1);
+    }
+
     return endDate;

6) In src/lib/userSyncAuth.ts around lines 799-800 and line 853, the code casts RPC
responses to "any" which bypasses type checking; define explicit TypeScript
interfaces representing the expected shape of the RPC responses for the
timezone-change and isWeekendForUser RPCs, replace the "as any" casts with
properly typed variables (or use a typed helper/decoder to validate shape at
runtime if needed), map the typed response fields to the function return types,
and update function signatures/usage so the compiler enforces the correct
structure instead of silencing types with "as any".

7) In src/lib/userSyncAuth.ts around lines 839-851, the current catch block logs
the RPC error then returns a client-side date fallback which violates the
server-authoritative design; remove the local-date fallback and instead
propagate the error (e.g., rethrow the caught error or return a rejected
Promise) so callers must handle RPC failures, keep a brief comment that this
function is server-authoritative, and update any callers/tests to expect and
handle the propagated error.

8) In src/store/useSettingsStore.ts around lines 199 to 207, the unguarded
console.log on line 206 should only run in development; wrap that console.log
call in a guard using import.meta.env.DEV (e.g. if (import.meta.env.DEV) {
console.log(...) }) so the message is emitted only in DEV builds and remains
consistent with the rest of the file's logging pattern.

9) In supabase/migrations/20251205000000_add_user_timezone.sql around line 28, the
current regex ^[A-Za-z_]+/[A-Za-z_]+$ only permits a single slash and disallows
digits and +/-; replace it with a pattern that allows multiple path segments and
numeric/plus/minus characters, e.g. ^[A-Za-z0-9_+-]+(?:/[A-Za-z0-9_+-]+)*$ so
timezones like America/Argentina/Buenos_Aires and GMT+8 are accepted.

10)In supabase/migrations/20251205000000_add_user_timezone.sql around lines 36 to
38, the weekend_days constraint checks length and ranges but allows duplicates
(e.g., [6,6]); update the constraint to also ensure the two entries are
different by adding a uniqueness check such as requiring weekend_days[1] <>
weekend_days[2] (or equivalently ensuring array_remove(weekend_days, NULL) and
array_length(array_agg(DISTINCT unnest(weekend_days)),1) = 2) so that the two
weekend days cannot be identical.

11)In supabase/migrations/20251205000003_timezone_change_rpc.sql around lines 62 to
68, the current regex validation for IANA timezones is too restrictive and will
reject valid values (multi-part names, numeric segments, hyphens); replace the
strict pattern with a more permissive check or switch to authoritative
validation: either broaden the regex to allow multiple slash-separated segments,
letters, digits, underscores and hyphens (e.g., permit [A-Za-z0-9_-]+ segments
separated by /) or, preferably, validate against PostgreSQL's pg_timezone_names
(e.g., check existence in pg_timezone_names.name) and return the rejected json
only if the timezone is not found.

12)In supabase/migrations/20251205000005_reset_monthly_counters.sql around lines 4
to 25, the migration creates reset_monthly_timezone_counters() which references
timezone_change_count_month but that column is dropped in the next migration,
leaving a broken function; fix by either removing this migration entirely if the
monthly-limit feature is abandoned, or keep the migration but also add a DROP
FUNCTION public.reset_monthly_timezone_counters(); statement to the subsequent
migration 20251206000000_remove_timezone_monthly_limit.sql so the function is
removed when the column is dropped, ensuring no dangling references remain.

13) In supabase/migrations/20251206000000_remove_timezone_monthly_limit.sql lines
1-9: the migration drops timezone_change_count_month but does not update or
remove the cron job function reset_monthly_timezone_counters() (created in
migration 20251205000005), so when the scheduled job runs it will reference the
dropped column and fail; fix by either updating the existing function to remove
any reads/updates to timezone_change_count_month (alter the function body to
only operate on remaining columns and logic) or drop the function and its
associated cron schedule entirely (DROP FUNCTION and remove scheduled job
entry), and ensure any other migrations or code that reference the column are
adjusted and the change is covered by a migration that keeps schema and
scheduled jobs consistent.

13)In supabase/migrations/20251206000001_update_timezone_change_rpc.sql around
lines 59-65, the current regex validation `^[A-Za-z_]+/[A-Za-z_]+$` incorrectly
rejects valid IANA zones (multi-part names and signs like +/−). Replace the
brittle regex with one of two fixes: either (A) perform an existence check
against PostgreSQL's timezone catalog (e.g., query pg_timezone_names to confirm
p_new_timezone is present) and return rejected if not found, or (B) broaden the
pattern to accept multiple slash-separated parts and allowed characters
(letters, digits, underscores, plus, minus) so it matches entries like
America/Indiana/Indianapolis and Etc/GMT+5. Implement option A if possible
(preferred), otherwise apply B and document the pattern.

14) In supabase/migrations/20251206000001_update_timezone_change_rpc.sql around
lines 59-65, the current regex validation `^[A-Za-z_]+/[A-Za-z_]+$` incorrectly
rejects valid IANA zones (multi-part names and signs like +/−). Replace the
brittle regex with one of two fixes: either (A) perform an existence check
against PostgreSQL's timezone catalog (e.g., query pg_timezone_names to confirm
p_new_timezone is present) and return rejected if not found, or (B) broaden the
pattern to accept multiple slash-separated parts and allowed characters
(letters, digits, underscores, plus, minus) so it matches entries like
America/Indiana/Indianapolis and Etc/GMT+5. Implement option A if possible
(preferred), otherwise apply B and document the pattern.

15)In supabase/migrations/20251208033600_restore_atomic_save_pomodoro.sql around
lines 20-27, the function signature includes an unused parameter
p_critical_success BOOLEAN DEFAULT false; remove this parameter from the CREATE
OR REPLACE FUNCTION parameter list so the signature only has p_user_id UUID,
p_duration_minutes INTEGER, p_xp_earned INTEGER, p_task_name TEXT DEFAULT NULL,
p_notes TEXT DEFAULT NULL, and then update any callers/tests/migrations that
pass the removed argument to stop providing it (or pass only the remaining
parameters); ensure there are no references to p_critical_success elsewhere in
the file before finalizing.