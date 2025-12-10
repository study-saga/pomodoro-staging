# Security Audit & Sentry Integration - Pomodoro Study App

**Date**: December 3, 2025
**Status**: Analysis Complete - Ready for Implementation
**Secrets**: ✅ All rotated (user confirmed)

---

## Executive Summary

Comprehensive security audit identified **2 critical vulnerabilities**, **3 high-priority issues**, and **several improvements needed** for production deployment. Sentry error tracking is working but needs optimization.

### Quick Stats
- **Critical Issues**: 2 (RLS bypass, CSRF weakness)
- **High Priority**: 3 (CSP risks, no rate limiting, token logging)
- **Sentry Status**: ✅ Working (needs source maps, user context, optimization)
- **RLS Policies**: ✅ Excellent (106 policies, properly enforced)
- **Secrets Exposure**: ✅ Safe (.env in gitignore, all rotated)

---

## Part 1: Sentry Error Tracking Analysis

### Current Status: ✅ WORKING

**Configuration File**: `src/main.tsx` (lines 15-33)

```typescript
Sentry.init({
  dsn: "https://07207291057d3269e8c544fa37a6261f@o4510434264875008.ingest.de.sentry.io/4510434268086352",
  integrations: [
    Sentry.browserTracingIntegration(),  // ✅ Performance monitoring
    Sentry.replayIntegration(),          // ✅ Session replay
  ],
  tracesSampleRate: 1.0,                 // ⚠️ 100% (burns quota)
  replaysSessionSampleRate: 0.1,         // ✅ 10%
  replaysOnErrorSampleRate: 1.0,         // ✅ 100% on errors

  // Discord Activity CSP bypass
  ...(isDiscordActivity() && {
    tunnel: '/sentry/api/4510434268086352/envelope/',
  }),
});
```

**Discord CSP Bypass** ✅:
- Discord Activity has strict CSP blocking Sentry
- Solution: Routes Sentry through Discord proxy (lines 80-82)
- Status: Working per PROJECT.md hotfix notes

**Package**: @sentry/react v10.27.0 (latest stable)

---

### Issues & Improvements Needed

#### 1. ⚠️ Source Maps Not Uploaded
**Current**: Generated (`vite.config.ts:24` - `sourcemap: true`)
**Missing**: No upload to Sentry during build
**Impact**: Stack traces show minified code like `index-BlU1I3HG.js:1`
**Fix**: Add Sentry Vite plugin

**Implementation**:
```bash
npm install @sentry/vite-plugin --save-dev
```

```typescript
// vite.config.ts
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: "study-saga",
      project: "pomodoro-react",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist/**',
        filesToDeleteAfterUpload: './dist/**/*.map'  // Remove from public
      }
    }),
  ],
  build: {
    sourcemap: 'hidden',  // Generate but don't expose
  }
});
```

**Environment Variable**:
```bash
# .env.local (NOT committed to git)
SENTRY_AUTH_TOKEN=sntrys_xxxxx  # Get from sentry.io/settings/auth-tokens
```

---

#### 2. 🔴 No User Context
**Current**: Errors not associated with users
**Impact**: Can't identify which users hit errors
**Fix**: Set user context after authentication

**Implementation**:
```typescript
// src/contexts/AuthContext.tsx (after line ~103)
// After successful Discord auth:
Sentry.setUser({
  id: user.id,
  username: user.username,
  discord_id: user.discord_id,
  role: user.role,
});

// On logout:
const logout = () => {
  Sentry.setUser(null);
  // ... existing logout logic
};
```

---

#### 3. ⚠️ Sample Rate Too High
**Current**: 100% transaction tracing (`tracesSampleRate: 1.0`)
**Impact**: Burns through Sentry quota in production
**Fix**: Environment-based sampling

**Implementation**:
```typescript
// src/main.tsx (replace lines 23-25)
const isProduction = window.location.hostname.includes('study-saga.com');

Sentry.init({
  dsn: "...",
  environment: isProduction ? 'production' : 'development',
  tracesSampleRate: isProduction ? 0.1 : 1.0,  // 10% prod, 100% dev
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/.*\.supabase\.co/,     // Supabase APIs
    /^https:\/\/.*\.study-saga\.com/,  // Production
  ],
  // ... rest
});
```

---

#### 4. 🟡 Placeholder API in Trace Propagation
**Current**: `tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/]`
**Issue**: Won't match Supabase Edge Functions
**Fix**: See sample rate implementation above

---

#### 5. 🔴 Token Logging in Production
**File**: `src/lib/discordAuth.ts`
**Lines**: 51, 56, 92, 98, 110, 111, 120, 139, 146, 163

**Issue**: `console.log` with sensitive data leaks in:
- Browser DevTools (user accessible)
- Sentry breadcrumbs (if error nearby)
- CI/CD logs

**Fix**: Conditional logging
```typescript
// Add at top of discordAuth.ts
const isDev = import.meta.env.DEV;
const log = {
  debug: isDev ? console.log : () => {},
  error: console.error,  // Always log errors
};

// Replace all console.log
log.debug('[Discord Auth] Token received successfully');
```

---

## Part 2: Security Vulnerabilities

### 🔴 CRITICAL (Fix Immediately)

#### VULN-1: Discord Activity RLS Bypass
**File**: `supabase/migrations/20251119_secure_daily_gift_claim.sql`
**Severity**: CRITICAL - Direct data manipulation

**Issue**: SECURITY DEFINER functions with no auth validation

**Vulnerable Code** (lines 85-120):
```sql
CREATE OR REPLACE FUNCTION claim_daily_gift_xp_discord(
  p_discord_id TEXT,
  p_gift_type gift_tier,
  p_xp_amount INTEGER
)
RETURNS JSONB
SECURITY DEFINER  -- ⚠️ Bypasses RLS
AS $$
  -- NO auth.uid() CHECK!
  UPDATE users
  SET xp = xp + p_xp_amount
  WHERE discord_id = p_discord_id;
$$;
```

**Attack Vector**:
```javascript
// Anyone with anon key can manipulate ANY user's XP
const { data } = await supabase.rpc('claim_daily_gift_xp_discord', {
  p_discord_id: 'victim_discord_id',
  p_gift_type: 'legendary',
  p_xp_amount: 999999
});
```

**Impact**:
- XP manipulation
- Unauthorized gift claiming
- Game economy broken

**Similar Functions Affected**:
- `save_completed_break_discord`
- `save_completed_pomodoro_discord` (if exists)
- Any SECURITY DEFINER with only discord_id param

**Fix Options**:

**Option A - Quick (Recommended for now)**:
```sql
-- Drop vulnerable functions
DROP FUNCTION IF EXISTS claim_daily_gift_xp_discord;
DROP FUNCTION IF EXISTS save_completed_break_discord;

-- Force Discord Activity users to use web auth
```

**Option B - Proper (More work)**:
Validate Discord access token server-side via new Edge Function

**User Decision**: Plan for later - document risk, revisit in future

---

#### VULN-2: Weak CSRF Protection in OAuth
**File**: `src/lib/discordAuth.ts`
**Severity**: CRITICAL - Session hijacking risk

**Issue**: OAuth state generated but never validated

**Vulnerable Code** (lines 13, 28-30):
```typescript
let oauthState: string | null = null;  // ⚠️ In-memory only

// Generate cryptographically random state
oauthState = generateCryptoRandomState();

// ❌ Never validated on callback!
// Missing: if (returnedState !== oauthState) throw Error()
```

**Attack Vector**:
1. Attacker initiates OAuth for victim
2. Victim approves OAuth
3. Attacker intercepts callback with victim's code
4. Attacker exchanges code for victim's token
5. Account takeover

**Fix**:
```typescript
// src/lib/discordAuth.ts

// REMOVE line 13: let oauthState: string | null = null;

// In authorize function (line ~28):
const state = generateCryptoRandomState();
sessionStorage.setItem('discord_oauth_state', state);

// In authenticate function (after line 92):
async function authenticate(code: string, stateFromCallback: string) {
  // Validate CSRF token
  const storedState = sessionStorage.getItem('discord_oauth_state');
  if (!storedState || storedState !== stateFromCallback) {
    throw new Error('Invalid OAuth state - possible CSRF attack');
  }
  sessionStorage.removeItem('discord_oauth_state');  // One-time use

  // ... existing token exchange
}

// Update setupDiscordSdk call (line 87-91):
const { code, state } = await setupDiscordSdk();
await authenticate(code, state);  // Pass state for validation
```

---

### 🟡 HIGH Priority

#### VULN-3: CSP Allows Unsafe Directives
**File**: `vercel.json` (line 12)
**Severity**: HIGH - Weakens XSS protection

**Current CSP**:
```json
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.discordsays.com"
"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
```

**Risk**:
- `'unsafe-inline'`: Allows inline `<script>` tags (XSS vector)
- `'unsafe-eval'`: Allows `eval()`, `new Function()` (major XSS risk)

**Why Allowed**: Discord Activity SDK may require `'unsafe-eval'`

**User Decision**: Keep Discord compatible - document risk

**Mitigation**:
- ✅ No user input in inline scripts
- ✅ Strict input validation (`chatService.ts`)
- ✅ React auto-escapes output
- ⚠️ Regular security audits needed

**Future Enhancement** (Optional):
```json
"script-src 'self' 'nonce-{random}' https://*.discordsays.com"
// Remove unsafe-*, use nonces for inline scripts
```

---

#### VULN-4: No Server-Side Rate Limiting
**Files**: All Edge Functions
**Severity**: HIGH - DoS/abuse risk

**Affected Endpoints**:
- `/supabase/functions/v1/discord-token` (token exchange)
- `/supabase/functions/v1/report-message` (reports)
- `/supabase/functions/v1/quick-ban` (bans)

**Attack Vector**:
```bash
# Spam endpoint to exhaust quota
for i in {1..100000}; do
  curl -X POST https://.../discord-token \
    -H "Content-Type: application/json" \
    -d '{"code":"fake"}'
done
```

**Impact**:
- Resource exhaustion
- Quota burnout
- Service downtime
- Increased costs

**User Decision**: Plan for later - not urgent

**Future Implementation** (Upstash Redis - Free tier):
```typescript
// supabase/functions/_shared/rateLimit.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_URL'),
  token: Deno.env.get('UPSTASH_REDIS_TOKEN'),
});

export async function rateLimit(
  key: string,      // e.g., `discord-token:${ip}`
  limit: number,    // e.g., 10 requests
  window: number    // e.g., 60 seconds
) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, window);
  if (count > limit) {
    throw new Error('Rate limit exceeded');
  }
}

// Usage in edge function:
await rateLimit(`discord-token:${ip}`, 10, 60);
```

**Cost**: FREE (Upstash: 10,000 requests/day)

---

#### VULN-5: Missing Security Headers
**File**: `vercel.json`
**Severity**: MEDIUM - Defense-in-depth

**Missing Headers**:
```json
"X-Frame-Options": "SAMEORIGIN",               // Clickjacking protection
"X-Content-Type-Options": "nosniff",           // MIME sniffing prevention
"Referrer-Policy": "strict-origin-when-cross-origin",
"Permissions-Policy": "geolocation=(), camera=()",
"Strict-Transport-Security": "max-age=31536000"
```

**Impact**:
- Clickjacking attacks possible
- Browser MIME confusion
- Referrer leakage
- Missing HTTPS enforcement

**Fix**:
```json
// vercel.json (after line 12)
{
  "source": "/(.*)",
  "headers": [
    {
      "key": "Content-Security-Policy",
      "value": "..."  // Existing
    },
    {
      "key": "X-Frame-Options",
      "value": "SAMEORIGIN"
    },
    {
      "key": "X-Content-Type-Options",
      "value": "nosniff"
    },
    {
      "key": "Referrer-Policy",
      "value": "strict-origin-when-cross-origin"
    },
    {
      "key": "Permissions-Policy",
      "value": "geolocation=(), microphone=(), camera=(), payment=()"
    },
    {
      "key": "Strict-Transport-Security",
      "value": "max-age=31536000; includeSubDomains"
    }
  ]
}
```

**Note**: `X-Frame-Options: SAMEORIGIN` allows Discord Activity iframe

---

### 🟢 MEDIUM Priority

#### VULN-6: No Cookie Consent (GDPR)
**Severity**: MEDIUM - Legal risk (EU/CA)

**Current**: Uses localStorage without consent

**Data Stored**:
- User preferences (Zustand persist)
- Auth tokens (Supabase)
- Settings (theme, volume, backgrounds)

**Impact**: GDPR/CCPA non-compliance for EU/California users

**Future Implementation** (before EU launch):
```bash
npm install vanilla-cookieconsent  # 3KB, GDPR compliant
```

```typescript
// src/components/CookieConsent.tsx
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import * as CookieConsent from 'vanilla-cookieconsent';

CookieConsent.run({
  categories: {
    necessary: { enabled: true, readOnly: true },
    analytics: { enabled: false }
  },
  onConsent: () => {
    // Initialize analytics only after consent
  }
});
```

---

#### VULN-7: Incomplete Input Validation
**File**: `src/lib/chatService.ts`
**Severity**: MEDIUM - PII leakage risk

**Current Validation** ✅:
- Profanity filter (obscenity package)
- Link blocking (regex)
- Length limits (500 chars)
- Repeated character/word checks

**Missing** ⚠️:
- Email pattern detection
- Phone number detection
- Server-side validation (client bypass possible)

**Impact**:
- Users may post emails/phone numbers (PII leak)
- Client validation bypassed via curl/Postman

**Fix**:
```typescript
// src/lib/chatService.ts (add to validateMessage)

// Email detection
const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
if (emailPattern.test(trimmed)) {
  return { valid: false, error: 'Please do not share email addresses' };
}

// Phone number detection
const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
if (phonePattern.test(trimmed)) {
  return { valid: false, error: 'Please do not share phone numbers' };
}
```

**Future**: Server-side validation Edge Function

---

## Part 3: Secure Areas (No Action Needed)

### ✅ Row Level Security (RLS)
**Status**: EXCELLENT - 106 policies properly enforced

**Key Files Reviewed**:
- `20251129160000_secure_chat_messages.sql` - Chat RLS
- `20251110172000_remove_insecure_anon_policies.sql` - Removed permissive policies
- `20251110173000_fix_null_auth_user_id_lockout.sql` - Fixed auth bypass

**Protections**:
- ✅ All tables have RLS enabled
- ✅ Policies use `auth.uid() = auth_user_id` validation
- ✅ No permissive `USING(true)` for anon role
- ✅ Chat bans enforced via RLS policy
- ✅ Moderator actions role-checked
- ✅ Atomic functions prevent race conditions

**Exception**: Discord Activity SECURITY DEFINER functions (VULN-1)

---

### ✅ SQL Injection Protection
**Status**: PROTECTED

**Why Secure**:
- ✅ All queries via Supabase SDK (parameterized)
- ✅ No raw SQL in client code
- ✅ RPC functions use typed parameters
- ✅ No string concatenation in queries

**Verified**: No `supabase.sql()` calls in `src/`

---

### ✅ XSS Protection
**Status**: GOOD (with documented CSP caveat)

**Protections**:
- ✅ No `dangerouslySetInnerHTML` in codebase
- ✅ No `innerHTML`, `eval()`, `new Function()` in src/
- ✅ React auto-escapes all output
- ⚠️ CSP allows `unsafe-inline` (VULN-3 - documented risk)

**Verified**: Grep search found zero XSS vectors

---

### ✅ Data Encryption
**Status**: SECURE

- ✅ **At rest**: Supabase PostgreSQL encryption
- ✅ **In transit**: HTTPS enforced
- ✅ **Token storage**: PKCE flow (secure)
- ✅ **Secrets**: No plaintext in localStorage
- ✅ **.env**: In gitignore, all secrets rotated

---

## Implementation Priority

### Phase 1: Immediate (Do Now)
**Time**: 2-3 hours

1. ✅ **Rotate secrets** (DONE - user confirmed)
2. 🔴 **Fix OAuth CSRF** (`src/lib/discordAuth.ts`)
3. 🔴 **Remove token logging** (`src/lib/discordAuth.ts`)
4. 🔴 **Add security headers** (`vercel.json`)

---

### Phase 2: High Priority (This Week)
**Time**: 3-4 hours

5. ⚠️ **Upload source maps** (`vite.config.ts`, install plugin)
6. 🔴 **Set user context** (`src/contexts/AuthContext.tsx`)
7. ⚠️ **Optimize Sentry sampling** (`src/main.tsx`)
8. 🟡 **Add email/phone validation** (`src/lib/chatService.ts`)

---

### Phase 3: Future Improvements
**Time**: TBD

9. 🔴 **Fix Discord RLS bypass** (redesign auth or disable)
10. 🟡 **Add rate limiting** (Upstash Redis integration)
11. 🟢 **Cookie consent** (vanilla-cookieconsent)
12. 🟢 **Server-side validation** (Edge Function)

---

## Files to Modify

### Sentry Improvements
1. `vite.config.ts` - Add Sentry plugin for source map upload
2. `src/main.tsx` - Optimize sample rates, add environment tag
3. `src/contexts/AuthContext.tsx` - Set user context on login/logout
4. `src/lib/discordAuth.ts` - Remove production token logging
5. `package.json` - Add @sentry/vite-plugin dependency

### Security Fixes
6. `src/lib/discordAuth.ts` - Add OAuth CSRF state validation
7. `vercel.json` - Add security headers (X-Frame-Options, etc.)
8. `src/lib/chatService.ts` - Add email/phone pattern validation
9. `supabase/migrations/NEW_secure_discord_functions.sql` - Fix RLS bypass (future)

### Documentation
10. `SECURITY.md` (NEW) - Security policy and vulnerability reporting
11. `DATABASE_MERGE.md` - Add security migration notes (already exists)

---

## Testing Checklist

### Sentry Tests
- [ ] Deploy with source maps enabled
- [ ] Trigger error, verify stack trace shows original source
- [ ] Check user context (discord_id, username) appears in Sentry
- [ ] Verify environment tag separates prod/dev errors
- [ ] Confirm 10% transaction sampling in production

### Security Tests
- [ ] Test OAuth CSRF validation (attempt state replay)
- [ ] Verify no token logs in production console
- [ ] Check security headers present in browser DevTools
- [ ] Attempt to call Discord RLS functions with wrong discord_id
- [ ] Test XSS attempts blocked by input validation
- [ ] Verify email/phone patterns rejected in chat

---

## Risk Assessment

| Issue | Severity | Effort | Impact | Priority | Status |
|-------|----------|--------|--------|----------|--------|
| Secrets exposed | CRITICAL | 1h | Credential theft | IMMEDIATE | ✅ DONE |
| OAuth CSRF | CRITICAL | 1h | Session hijacking | IMMEDIATE | ⏳ TODO |
| Token logging | HIGH | 1h | Token leakage | IMMEDIATE | ⏳ TODO |
| Security headers | MEDIUM | 30m | Defense-in-depth | IMMEDIATE | ⏳ TODO |
| Source maps | MEDIUM | 1h | Better debugging | HIGH | ⏳ TODO |
| User context | LOW | 30m | Error attribution | HIGH | ⏳ TODO |
| Sentry sampling | LOW | 30m | Quota savings | HIGH | ⏳ TODO |
| Discord RLS bypass | CRITICAL | 4h+ | XP manipulation | FUTURE | 📋 PLANNED |
| Rate limiting | HIGH | 4h+ | DoS prevention | FUTURE | 📋 PLANNED |
| Cookie consent | MEDIUM | 2h | GDPR compliance | FUTURE | 📋 PLANNED |

---

## Success Criteria

### Sentry ✅
- Source maps uploaded automatically on build
- Stack traces show original TypeScript source
- User context visible in all error reports
- Environment tag separates prod/dev
- Production logs clean (no tokens/secrets)
- Transaction sampling at 10% in prod

### Security ✅
- OAuth state validated (CSRF protected)
- Security headers present in all responses
- No sensitive data in console logs
- Input validation blocks PII (email/phone)
- RLS policies documented with known risks
- All secrets rotated and secure

---

## Unresolved Questions

1. **Sentry**: Do we need to optimize source map size for upload quota?
2. **Discord Activity**: Keep for production or deprecate entirely?
3. **GDPR**: When is EU launch planned? (cookie consent deadline)
4. **Rate Limiting**: What's acceptable request volume for free tier?
5. **Audit Trail**: Do we need to track who performed quick-ban actions?
6. **Discord RLS**: Redesign auth or disable Discord Activity mode?

---

## Reference Links

**Sentry Documentation**:
- [Vite Plugin](https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/uploading/vite/)
- [User Context](https://docs.sentry.io/platforms/javascript/enriching-events/identify-user/)
- [Sampling](https://docs.sentry.io/platforms/javascript/configuration/sampling/)

**Security Best Practices**:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CSP Guide](https://content-security-policy.com/)
- [CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

**Compliance**:
- [GDPR Cookie Consent](https://gdpr.eu/cookies/)
- [Vanilla CookieConsent](https://github.com/orestbida/cookieconsent)

---

**Last Updated**: December 3, 2025
**Next Review**: After Phase 1 implementation
