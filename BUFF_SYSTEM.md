# Buff System Documentation

## Overview
Extensible event buff system with:
- **Additive stacking** (25% + 25% = 50% total)
- **JSONB database storage** for flexibility
- **Role-specific and universal buffs**
- **Automatic activation via hooks**
- **Event period validation**

## Architecture

### Database Layer
- **Column:** `users.active_buffs` (JSONB)
- **Structure:**
```json
{
  "buff_id": {
    "value": 0.25,           // XP multiplier (0.25 = +25%)
    "expires_at": 1732223400000,  // Milliseconds (null = permanent)
    "metadata": {}           // Optional event data
  }
}
```

### Application Layers
1. **buffManager.ts** - Core logic (stack calculation, DB functions)
2. **roleSystem.ts** - Buff configuration (EVENT_BUFFS array)
3. **useBuffActivation.ts** - Auto-activation hooks
4. **useSettingsStore.ts** - XP calculation integration
5. **LevelDisplay.tsx** - UI rendering

## How to Add a New Event Buff

### Step 1: Define Buff Configuration
Add to `src/data/roleSystem.ts`:

```typescript
export const EVENT_BUFFS: RoleBuff[] = [
  // Existing buffs...
  {
    id: 'winter_event_2025',
    name: 'Winter Wonderland',
    description: '+30% XP boost (Dec 15-31 event)',
    icon: '❄️',
    type: 'passive',
    category: 'event',
    roles: ['elf', 'human'], // or undefined for all roles
    xpBonus: 0.30, // +30% XP
  },
];
```

### Step 2: Add Auto-Activation Logic
Update `src/hooks/useBuffActivation.ts`:

```typescript
export function useBuffActivation() {
  const { appUser } = useAuth();
  const { levelPath, activeBuffs, settingsSyncComplete } = useSettingsStore();

  useEffect(() => {
    if (!settingsSyncComplete || !appUser?.id) return;

    // Existing slingshot activation...

    // NEW: Winter event activation
    const activateWinterEventIfNeeded = async () => {
      // Role check (if role-specific)
      if (!['elf', 'human'].includes(levelPath)) return;

      // Already active check
      if (activeBuffs.winter_event_2025) {
        console.log('[BuffActivation] Winter event already active');
        return;
      }

      // Date check
      const today = new Date();
      const startDate = new Date('2025-12-15');
      const endDate = new Date('2026-01-01'); // Exclusive end

      if (today < startDate || today >= endDate) {
        console.log('[BuffActivation] Winter event not in active period');
        return;
      }

      console.log('[BuffActivation] Auto-activating winter event');

      try {
        await setUserBuff(
          appUser.id,
          'winter_event_2025',
          0.30, // +30%
          null, // No expiration during event period
          { autoActivatedAt: Date.now() }
        );

        useSettingsStore.setState({
          activeBuffs: {
            ...activeBuffs,
            winter_event_2025: {
              value: 0.30,
              expiresAt: null,
              metadata: { autoActivatedAt: Date.now() }
            }
          }
        });

        console.log('[BuffActivation] ✓ Winter event activated');
      } catch (error) {
        console.error('[BuffActivation] Failed to activate winter event:', error);
      }
    };

    activateWinterEventIfNeeded();
  }, [appUser?.id, levelPath, settingsSyncComplete, activeBuffs]);
}
```

### Step 3: Add UI Display
Update `src/components/level/LevelDisplay.tsx`:

```typescript
// Add icon import
import winterEventIcon from '../../assets/buff-winter-event.svg';

// Add visibility check
const shouldShowWinterEvent = () => {
  const today = new Date();
  const startDate = new Date('2025-12-15');
  const endDate = new Date('2026-01-01');
  const notificationStart = new Date(startDate);
  notificationStart.setHours(notificationStart.getHours() - 48); // 48h before

  return today >= notificationStart && today < endDate;
};

const winterEventActive = activeBuffs.winter_event_2025 &&
  (!activeBuffs.winter_event_2025.expiresAt ||
   activeBuffs.winter_event_2025.expiresAt > Date.now());

// Add icon render in buff list
{shouldShowWinterEvent() && (
  <div className="relative group">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-help overflow-hidden ${
      winterEventActive
        ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-2 border-blue-500'
        : 'bg-gradient-to-r from-gray-500/20 to-gray-600/20 border-2 border-blue-500/50'
    }`}>
      <img
        src={winterEventIcon}
        alt="Winter Event"
        className="w-full h-full object-cover"
        style={{
          filter: winterEventActive
            ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.5))'
            : 'grayscale(100%) opacity(50%)'
        }}
      />
    </div>

    {/* Tooltip */}
    <div className="absolute left-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
      <div className={`bg-gray-900/95 backdrop-blur-xl rounded-lg px-3 py-2 shadow-lg min-w-[180px] ${
        winterEventActive ? 'border border-blue-500/30' : 'border border-gray-500/30'
      }`}>
        <p className={`text-xs font-semibold mb-0.5 ${
          winterEventActive ? 'text-blue-300' : 'text-gray-400'
        }`}>
          Winter Wonderland ❄️
        </p>
        <p className="text-[10px] text-gray-400">
          {winterEventActive
            ? '+30% XP (Dec 15-31 event)'
            : 'Activates Dec 15-31, 2025'}
        </p>
      </div>
    </div>
  </div>
)}
```

### Step 4: Add Event Period Validation
Update `src/lib/buffManager.ts` in `calculateBuffStack`:

```typescript
// Add new event validation
if (buffId === 'winter_event_2025') {
  const today = new Date();
  const startDate = new Date('2025-12-15');
  const endDate = new Date('2026-01-01');
  const isEventActive = today >= startDate && today < endDate;

  if (!isEventActive) {
    console.log('[BuffManager] Winter event not active, keeping in storage');
    continue; // Skip XP bonus but preserve in DB
  }
}
```

## XP Calculation Flow

```
User completes pomodoro
  ↓
addXP(minutes) called
  ↓
calculateBuffStack(activeBuffs, roleType)
  ├─ Filters expired buffs
  ├─ Validates event periods
  ├─ Checks role restrictions
  └─ Returns totalXPMultiplier (e.g., 1.55 = +55%)
  ↓
calculateRoleXP(roleType, minutes, { eventBuffMultiplier })
  ├─ Applies base role bonuses (elf +0.5/min, human crit chance)
  ├─ Applies event buffs (ADDITIVE)
  └─ Applies human crits (MULTIPLICATIVE, last)
  ↓
XP awarded to user
```

## Buff Stacking Rules

### Additive Stacking (Event Buffs)
- Day 10 boost (+25%) + Slingshot (+25%) = **+50% total**
- Calculated as: `1.0 + 0.25 + 0.25 = 1.50x multiplier`

### Multiplicative (Human Crits)
- Applied AFTER all additive buffs
- Example: Base 10 XP → +50% event buffs = 15 XP → Crit 2x = **30 XP**

## Database Functions

### Set Buff
```typescript
import { setUserBuff } from '../lib/buffManager';

await setUserBuff(
  userId,
  'buff_id',
  0.25, // +25%
  expiresAt, // milliseconds or null
  { customData: 'value' } // optional metadata
);
```

### Remove Buff
```typescript
import { removeUserBuff } from '../lib/buffManager';

await removeUserBuff(userId, 'buff_id');
```

### Clear Expired
```typescript
import { clearExpiredBuffs } from '../lib/buffManager';

await clearExpiredBuffs(userId);
```

## Testing

### Manual Activation
```typescript
// In browser console or dev tools
import { setUserBuff } from './lib/buffManager';

await setUserBuff(
  'user-uuid-here',
  'test_buff',
  0.50, // +50% for testing
  Date.now() + (60 * 60 * 1000), // 1 hour
  { test: true }
);
```

### Date Simulation
```typescript
// Override date in LevelDisplay for testing
const today = new Date('2025-12-20'); // Test date
```

## Migration Workflow

1. **Create migration:** `supabase/migrations/YYYYMMDD_event_name.sql`
2. **Test locally:** `npm run db:migrate`
3. **Apply to staging:** Via Supabase dashboard
4. **Apply to production:** After testing

## Best Practices

1. **Always use milliseconds** for timestamps
2. **Check role restrictions** in both activation and calculation
3. **Log buff state** for debugging (`console.log('[BuffManager] ...')`)
4. **Keep buffs in storage** after event ends (don't delete, just stop applying)
5. **Use 48h pre-notification** for event icons (gray state)
6. **Validate dates** in multiple places (activation, display, XP calculation)

## Current Active Buffs

| Buff ID | Roles | Value | Period | Type |
|---------|-------|-------|--------|------|
| `day10_boost` | All | +25% | 24h after claim | Time-limited |
| `slingshot_nov22` | Elf only | +25% | Nov 22-23, 2025 | Event period |

## Future Enhancements

- **Seasonal buffs** (winter, summer events)
- **Quest-based buffs** (complete X pomodoros)
- **Social buffs** (party with friends)
- **Premium buffs** (supporter perks)
- **Conditional buffs** (active only during certain hours)
