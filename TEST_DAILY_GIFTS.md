# Daily Gifts Testing Guide

## Local Test Environment

Your local development server is now running at:
- **Local URL**: http://localhost:5174/
- **Network URLs**:
  - http://10.5.0.2:5174/
  - http://192.168.2.4:5174/

Branch: `test/daily-gifts-local`

---

## What Was Fixed

### 1. XP Rewards Now Work ✅
- Daily gifts now actually award XP to your account
- XP is synced to the database using the `increment_user_xp` RPC function
- No fake pomodoro entries are created - XP is awarded directly
- Your level bar will update immediately when you claim a gift

### 2. Gift Values Are Randomized ✅
Each day now has different XP rewards:
- **Days 1-9, 11**: Random XP (10, 20, or 30 XP)
- **Day 10**: Special Tomato 🍅 with +50 XP bonus
- **Day 12**: Mystery Gift 🎁 with +100 XP bonus

### 3. Visual Fixes ✅
- Day 12 now shows a gift emoji 🎁
- Modal stays open for 3 seconds instead of 2.5s
- Better visibility of rewards

---

## How to Test

### Test 1: Basic XP Award (Most Important!)

1. **Open the app**: http://localhost:5174/
2. **Check your current XP**: Look at the level display in the top-left corner
3. **Trigger the daily gift**:
   - The gift modal should appear automatically on first login each day
   - If it doesn't appear, you need to simulate a new day (see below)
4. **Watch for XP increase**:
   - After 0.5 seconds, the gift box will reveal
   - Your XP bar should increase immediately
   - Check the browser console (F12) for:
     - `[DailyGift] Awarded X XP for day Y`
     - `[addDailyGiftXP] ✓ X XP synced to database`

### Test 2: Simulate Different Days

To test different login days without waiting, use the browser console (F12):

```javascript
// Open browser console (F12) and run:

// Reset to Day 1
localStorage.setItem('pomodoroSettings', JSON.stringify({
  ...JSON.parse(localStorage.getItem('pomodoroSettings')),
  lastLoginDate: null,
  consecutiveLoginDays: 0
}));
window.location.reload();

// Simulate Day 2 (yesterday login)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
localStorage.setItem('pomodoroSettings', JSON.stringify({
  ...JSON.parse(localStorage.getItem('pomodoroSettings')),
  lastLoginDate: yesterday.toISOString().split('T')[0],
  consecutiveLoginDays: 1
}));
window.location.reload();

// Simulate Day 10 (Special Tomato - 50 XP)
const day9 = new Date();
day9.setDate(day9.getDate() - 1);
localStorage.setItem('pomodoroSettings', JSON.stringify({
  ...JSON.parse(localStorage.getItem('pomodoroSettings')),
  lastLoginDate: day9.toISOString().split('T')[0],
  consecutiveLoginDays: 9
}));
window.location.reload();

// Simulate Day 12 (Mystery Gift - 100 XP!)
const day11 = new Date();
day11.setDate(day11.getDate() - 1);
localStorage.setItem('pomodoroSettings', JSON.stringify({
  ...JSON.parse(localStorage.getItem('pomodoroSettings')),
  lastLoginDate: day11.toISOString().split('T')[0],
  consecutiveLoginDays: 11
}));
window.location.reload();
```

### Test 3: Verify Gift Randomization

1. **Test different days** using the console commands above
2. **Notice the variety**:
   - Days 1-9, 11 show different XP values (+10, +20, or +30)
   - Same day always shows same reward (consistent seeding)
3. **Special days**:
   - Day 10 always shows tomato 🍅 with +50 XP
   - Day 12 always shows gift 🎁 with +100 XP

### Test 4: Database Persistence

1. **Claim a daily gift** and note your new XP
2. **Refresh the page** (F5)
3. **Verify XP persists** - your XP should stay the same
4. **Check browser console** for: `[addXP] ✓ XP synced to database`

---

## Console Commands Cheat Sheet

Open browser DevTools (F12 → Console tab) and paste these:

### Check Current State
```javascript
const settings = JSON.parse(localStorage.getItem('pomodoroSettings'));
console.log('Current Day:', settings.consecutiveLoginDays);
console.log('Last Login:', settings.lastLoginDate);
console.log('Current XP:', settings.xp);
console.log('Current Level:', settings.level);
```

### Force Show Daily Gift Modal (Current Day)
```javascript
// This will show the gift for your current consecutive login day
window.location.reload();
```

### Skip to Day 10 (Special Tomato)
```javascript
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const settings = JSON.parse(localStorage.getItem('pomodoroSettings'));
settings.lastLoginDate = yesterday.toISOString().split('T')[0];
settings.consecutiveLoginDays = 9;
localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
window.location.reload();
```

### Skip to Day 12 (Mystery Gift)
```javascript
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const settings = JSON.parse(localStorage.getItem('pomodoroSettings'));
settings.lastLoginDate = yesterday.toISOString().split('T')[0];
settings.consecutiveLoginDays = 11;
localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
window.location.reload();
```

### Reset Everything (Start Fresh)
```javascript
localStorage.clear();
window.location.reload();
```

---

## Expected Behavior

### ✅ What Should Happen:
1. Daily gift modal appears on first login each day
2. Gift box reveals after 0.5 seconds
3. XP bar increases immediately
4. Console shows: `[DailyGift] Awarded X XP for day Y`
5. Console shows: `[addDailyGiftXP] ✓ X XP synced to database`
6. Modal closes automatically after 3 seconds
7. XP persists after page refresh
8. No fake pomodoro entries are created in the database

### ❌ What Should NOT Happen:
- Gift modal appearing multiple times per day
- XP not increasing when gift is claimed
- Same XP value for all days 1-9
- Empty gift box on day 12
- XP disappearing after page refresh

---

## Debugging

If something doesn't work:

1. **Open DevTools Console** (F12)
2. **Look for errors** (red text)
3. **Check for logs**:
   - `[DailyGift] Awarded X XP for day Y` - XP was awarded
   - `[addDailyGiftXP] ✓ X XP synced to database` - Database sync successful
   - `[addDailyGiftXP] No authenticated user` - Not logged in (expected in browser mode)

4. **Check localStorage**:
```javascript
console.log(JSON.parse(localStorage.getItem('pomodoroSettings')));
```

---

## When You're Done Testing

### If Everything Works:
```bash
# Switch back to animations branch
git checkout animations

# The changes are already committed there
# You can push to test on staging:
git push origin animations
```

### If You Find Issues:
```bash
# Switch back to animations branch
git checkout animations

# Tell me what's wrong and I'll fix it!
```

### Clean Up Test Branch (Optional):
```bash
# Delete the test branch
git branch -D test/daily-gifts-local
```

---

## Quick Test Checklist

- [ ] Open http://localhost:5174/
- [ ] Daily gift modal appears automatically
- [ ] Gift box reveals after 0.5s
- [ ] XP bar increases visibly
- [ ] Console shows XP awarded message
- [ ] Modal closes after 3 seconds
- [ ] Refresh page - XP still there
- [ ] Test Day 10 - see tomato 🍅 (+50 XP)
- [ ] Test Day 12 - see gift 🎁 (+100 XP)
- [ ] Different days show different XP values

---

**All tests passing?** You're ready to push to production! 🚀
