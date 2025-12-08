import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { claimDailyGift } from '../../lib/userSyncAuth';
import { getRewardForDay, getDaysInMonth } from '../../config/dailyGiftCalendar';
import type { RewardType } from '../../config/dailyGiftCalendar';

interface DailyGiftGridProps {
  show: boolean;
  onClose: () => void;
}

interface GiftBox {
  day: number; // Calendar day (1-31)
  type: RewardType;
  emoji: string;
  xpAmount?: number;
  boostDuration?: number;
  boostMultiplier?: number;
  description?: string;
  isRevealed: boolean; // Past days
  isSelected: boolean; // Today
  isLocked: boolean; // Future days
  isOutOfMonth: boolean; // Days beyond current month
}

export function DailyGiftGrid({ show, onClose }: DailyGiftGridProps) {
  const markDailyGiftClaimed = useSettingsStore((state) => state.markDailyGiftClaimed);
  const userId = useSettingsStore((state) => state.userId);
  const discordId = useSettingsStore((state) => state.discordId);

  // Generate calendar-based gifts for the current month
  const initializeGifts = (): GiftBox[] => {
    const now = new Date();
    const currentDayOfMonth = now.getDate(); // 1-31
    const daysInCurrentMonth = getDaysInMonth(now.getFullYear(), now.getMonth());

    // Only generate boxes for actual days in current month
    const gifts: GiftBox[] = [];

    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const reward = getRewardForDay(day);

      gifts.push({
        day,
        type: reward.type,
        emoji: reward.emoji || '🍅',
        xpAmount: reward.xpAmount,
        boostDuration: reward.boostDuration,
        boostMultiplier: reward.boostMultiplier,
        description: reward.description,
        isRevealed: day < currentDayOfMonth, // Past days
        isSelected: day === currentDayOfMonth, // Today
        isLocked: day > currentDayOfMonth, // Future days
        isOutOfMonth: false, // Never out of month since we only render valid days
      });
    }

    return gifts;
  };

  const [gifts, setGifts] = useState<GiftBox[]>(() => initializeGifts());
  const [xpAwarded, setXpAwarded] = useState(false);

  // Reinitialize gifts when modal is shown
  useEffect(() => {
    if (show) {
      setGifts(initializeGifts());
      setXpAwarded(false); // Reset XP awarded flag
    }
  }, [show]);

  // Auto-reveal current day's gift, award XP via server, and auto-close
  useEffect(() => {
    if (!show) {
      return;
    }

    const now = new Date();
    const currentDayOfMonth = now.getDate();

    // Check if gift was already claimed before attempting to claim
    const checkAndClaimGift = async () => {
      // Check localStorage first for quick UI feedback
      const today = new Date().toISOString().split('T')[0];
      const lastGiftDate = useSettingsStore.getState().lastDailyGiftDate;

      if (lastGiftDate === today) {
        import.meta.env.DEV && console.log('[DailyGift] Gift already claimed today (localStorage check)');
        setXpAwarded(true);
        // Reveal the gift immediately since it was already claimed
        setGifts(prev => prev.map(g => ({
          ...g,
          isRevealed: g.day < currentDayOfMonth || (g.day === currentDayOfMonth),
        })));
        return;
      }

      // Wait 0.5s for entrance animation, then reveal current day's gift
      await new Promise(resolve => setTimeout(resolve, 500));

      setGifts(prev => prev.map(g => ({
        ...g,
        isRevealed: g.day <= currentDayOfMonth,
      })));

      // Award XP for the current day's gift (SERVER-SIDE)
      if (!xpAwarded) {
        const currentGift = gifts.find(g => g.day === currentDayOfMonth);
        if (currentGift?.xpAmount) {
          try {
            // Check if user is authenticated (either web or Discord mode)
            if (!userId && !discordId) {
              console.warn('[DailyGift] No user ID or Discord ID - gift not claimed');
              markDailyGiftClaimed(); // Mark locally to prevent re-showing
              setXpAwarded(true);
              return;
            }

            // Check if this is a boost gift
            const isBoostGift = currentGift.type === 'boost';

            // Claim gift via server-side validation
            // RPC function handles both web and Discord auth modes
            const result = await claimDailyGift(
              userId,
              currentGift.xpAmount,
              isBoostGift,
              currentGift.boostDuration,
              currentGift.boostMultiplier || 1.25
            );

            if (result.success) {
              import.meta.env.DEV && console.log(`[DailyGift] ✓ Claimed ${result.xpAwarded} XP from server`);

              // Mark gift as claimed locally for UI consistency
              markDailyGiftClaimed();
              setXpAwarded(true);

              // Update local XP state immediately (skip sync since RPC already did it)
              // Use the new total XP from server if available, otherwise add the amount
              if (result.xpAwarded) {
                useSettingsStore.getState().addDailyGiftXP(result.xpAwarded, true);
              }

              // Centralize boost state: sync to local store if activated
              if (result.boostActivated && result.boostExpiresAt) {
                import.meta.env.DEV && console.log(`[DailyGift] ✓ Pomodoro boost activated until ${new Date(result.boostExpiresAt)}`);
                useSettingsStore.setState({
                  pomodoroBoostActive: true,
                  pomodoroBoostExpiresAt: result.boostExpiresAt,
                  pomodoroBoostMultiplier: result.boostMultiplier || 1.25
                });
              }
            } else if (result.alreadyClaimed) {
              import.meta.env.DEV && console.log('[DailyGift] Gift already claimed today (verified by server)');
              markDailyGiftClaimed();
              setXpAwarded(true);
            }
          } catch (error) {
            console.error('[DailyGift] Failed to claim gift:', error);
            // Mark as claimed locally to prevent repeated attempts
            markDailyGiftClaimed();
            setXpAwarded(true);
          }
        }
      }
    };

    checkAndClaimGift();

    // Auto-close after 3 seconds total (give user time to see the reward)
    const closeTimer = setTimeout(() => {
      import.meta.env.DEV && console.log('[DailyGift] Auto-closing modal');
      onClose();
    }, 3000);

    return () => {
      clearTimeout(closeTimer);
    };
    // Only re-run when show changes, not when gifts/xpAwarded changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          {/* Background overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-md pointer-events-none"
          />

          {/* Main container */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative z-10"
          >
            {/* Title */}
            <motion.h2
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl sm:text-3xl font-bold text-white/90 text-center mb-4 sm:mb-6"
            >
              Daily Gift
            </motion.h2>

            {/* Grid of gifts - 6 cols mobile, 7 cols desktop */}
            <div className="grid grid-cols-6 sm:grid-cols-7 gap-2 sm:gap-3 max-w-[90vw] sm:max-w-4xl">
              {gifts.map((gift, index) => (
                <GiftCard
                  key={gift.day}
                  gift={gift}
                  index={index}
                />
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface GiftCardProps {
  gift: GiftBox;
  index: number;
}

function GiftCard({ gift, index }: GiftCardProps) {
  const isBoostRevealed = gift.type === 'boost' && gift.isRevealed;
  const isAlreadyClaimed = gift.isRevealed && !gift.isSelected;
  const isDisabled = gift.isLocked || gift.isOutOfMonth;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.02, type: 'spring', stiffness: 350, damping: 20 }}
      className="relative aspect-square"
    >
      {/* Day number label */}
      <div className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1 text-[11px] sm:text-[10px] font-medium text-white/40 z-10">
        {gift.day}
      </div>

      {/* Card background */}
      <div
        className={`
          absolute inset-0 rounded-xl
          transition-all duration-300
          ${isDisabled
            ? 'bg-white/[0.02] border border-white/5 opacity-30'
            : gift.isSelected
              ? 'bg-white/10 border-2 border-purple-400/60 shadow-lg shadow-purple-500/20'
              : 'bg-white/5 border border-white/10'
          }
          ${isBoostRevealed
            ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-400/40'
            : ''
          }
        `}
      />

      {/* Claimed overlay */}
      {isAlreadyClaimed && (
        <div className="absolute inset-0 rounded-xl bg-black/30 backdrop-blur-[2px]" />
      )}

      {/* Subtle glow for boost gifts */}
      {isBoostRevealed && (
        <motion.div
          animate={{
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="absolute inset-0 rounded-xl bg-orange-500/10 blur-xl"
        />
      )}


      {/* Card content */}
      <div className="relative h-full flex items-center justify-center">
        {/* Disabled/locked/out of month days */}
        {isDisabled && (
          <span className="text-xl sm:text-2xl opacity-20">{gift.emoji}</span>
        )}

        {/* Unrevealed gifts (future days in current month) */}
        {!gift.isRevealed && !isDisabled && (
          <span className="text-2xl sm:text-3xl opacity-70">{gift.emoji}</span>
        )}

        {/* Already claimed gifts show emoji + checkmark badge */}
        {isAlreadyClaimed && (
          <>
            <span className="text-2xl sm:text-3xl opacity-40">{gift.emoji}</span>
            <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-green-500/80 flex items-center justify-center">
              <span className="text-white text-[9px] sm:text-[10px] font-bold">✓</span>
            </div>
          </>
        )}

        {/* Current day - revealed */}
        {gift.isSelected && gift.isRevealed && (
          <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1">
            {/* XP rewards */}
            {gift.type === 'xp' && gift.xpAmount && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-base sm:text-xl font-bold text-amber-300"
              >
                +{gift.xpAmount}xp
              </motion.span>
            )}

            {/* Boost rewards */}
            {gift.type === 'boost' && (
              <>
                <motion.span
                  animate={{
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                  className="text-2xl sm:text-3xl"
                >
                  {gift.emoji}
                </motion.span>
                {gift.description && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-white/80 text-[8px] sm:text-[9px] font-medium text-center px-0.5 sm:px-1 leading-tight"
                  >
                    {gift.description}
                  </motion.p>
                )}
              </>
            )}

            {/* Special rewards */}
            {gift.type === 'special' && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="text-2xl sm:text-3xl"
              >
                {gift.emoji}
              </motion.span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
