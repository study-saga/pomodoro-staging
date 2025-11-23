import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { claimDailyGift } from '../../lib/userSyncAuth';
import { supabase } from '../../lib/supabase';

interface DailyGiftGridProps {
  show: boolean;
  onClose: () => void;
  currentDay: number; // 1-12, which day of consecutive visits
}

type GiftType = 'xp' | 'reward' | 'special' | 'gift';

interface GiftBox {
  id: number;
  type: GiftType;
  value: string;
  xpAmount?: number; // Actual XP to award
  description?: string; // Description text for special gifts
  isRevealed: boolean;
  isSelected: boolean;
}

export function DailyGiftGrid({ show, onClose, currentDay }: DailyGiftGridProps) {
  const markDailyGiftClaimed = useSettingsStore((state) => state.markDailyGiftClaimed);

  // Generate randomized gifts based on the day (seeded randomness for consistency)
  const initializeGifts = (day: number): GiftBox[] => {
    // Seed the random number generator with the day for consistent results
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const baseGifts: Omit<GiftBox, 'isRevealed' | 'isSelected'>[] = [];

    for (let i = 1; i <= 12; i++) {
      const random = seededRandom(i * 137); // Use prime number for better distribution

      if (i === 10) {
        // Day 10 is always the special tomato with bonus XP
        baseGifts.push({
          id: i,
          type: 'special',
          value: '🍅',
          xpAmount: 50, // 5x bonus
          description: '+25% For all Pomodoros [24hrs]'
        });
      } else if (i === 12) {
        // Day 12 is always a mystery gift with huge XP
        baseGifts.push({
          id: i,
          type: 'gift',
          value: '🎁',
          xpAmount: 100 // 10x bonus
        });
      } else {
        // Days 1-9, 11: Randomized XP rewards
        let xpAmount: number;
        let displayValue: string;

        if (random < 0.5) {
          // 50% chance: Small reward (10 XP = 1 minute)
          xpAmount = 10;
          displayValue = '+10xp';
        } else if (random < 0.8) {
          // 30% chance: Medium reward (20 XP = 2 minutes)
          xpAmount = 20;
          displayValue = '+20xp';
        } else {
          // 20% chance: Large reward (30 XP = 3 minutes)
          xpAmount = 30;
          displayValue = '+30xp';
        }

        baseGifts.push({
          id: i,
          type: 'xp',
          value: displayValue,
          xpAmount
        });
      }
    }

    return baseGifts.map(gift => ({
      ...gift,
      // Mark previous days as revealed, current day as selected but not revealed yet
      isRevealed: gift.id < day,
      isSelected: gift.id === day,
    }));
  };

  const [gifts, setGifts] = useState<GiftBox[]>(() => initializeGifts(currentDay));
  const [xpAwarded, setXpAwarded] = useState(false);

  // Reinitialize gifts when show becomes true with updated currentDay
  useEffect(() => {
    if (show) {
      setGifts(initializeGifts(currentDay));
      setXpAwarded(false); // Reset XP awarded flag
    }
  }, [show, currentDay]);

  // Auto-reveal current day's gift, award XP via server, and auto-close
  useEffect(() => {
    if (!show || currentDay < 1 || currentDay > 12) {
      return;
    }

    // Check if gift was already claimed before attempting to claim
    const checkAndClaimGift = async () => {
      // Check localStorage first for quick UI feedback
      const today = new Date().toISOString().split('T')[0];
      const lastGiftDate = useSettingsStore.getState().lastDailyGiftDate;

      if (lastGiftDate === today) {
        console.log('[DailyGift] Gift already claimed today (localStorage check)');
        setXpAwarded(true);
        // Reveal the gift immediately since it was already claimed
        setGifts(prev => prev.map(g => ({
          ...g,
          isRevealed: g.id <= currentDay,
        })));
        return;
      }

      // Wait 0.5s for entrance animation, then reveal current day's gift
      await new Promise(resolve => setTimeout(resolve, 500));

      setGifts(prev => prev.map(g => ({
        ...g,
        isRevealed: g.id <= currentDay,
      })));

      // Award XP for the current day's gift (SERVER-SIDE)
      if (!xpAwarded) {
        const currentGift = gifts.find(g => g.id === currentDay);
        if (currentGift?.xpAmount) {
          try {
            // Get current auth user and app user
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
              console.warn('[DailyGift] No authenticated user - gift not claimed');
              markDailyGiftClaimed(); // Mark locally to prevent re-showing
              setXpAwarded(true);
              return;
            }

            const { data: appUser } = await supabase
              .from('users')
              .select('id, discord_id')
              .eq('auth_user_id', session.user.id)
              .maybeSingle();

            if (!appUser) {
              console.warn('[DailyGift] No app user found - gift not claimed');
              markDailyGiftClaimed(); // Mark locally to prevent re-showing
              setXpAwarded(true);
              return;
            }

            // Check if this is the special tomato gift (day 10) that activates boost
            const isBoostGift = currentGift.type === 'special';

            // Claim gift via server-side validation
            const result = await claimDailyGift(
              appUser.id,
              appUser.discord_id,
              currentGift.xpAmount,
              isBoostGift
            );

            if (result.success) {
              console.log(`[DailyGift] ✓ Claimed ${result.xpAwarded} XP from server`);

              // Mark gift as claimed locally for UI consistency
              markDailyGiftClaimed();
              setXpAwarded(true);

              // Centralize boost state: sync to local store if activated
              if (result.boostActivated && result.boostExpiresAt) {
                console.log(`[DailyGift] ✓ Pomodoro boost activated until ${new Date(result.boostExpiresAt)}`);
                useSettingsStore.setState({
                  pomodoroBoostActive: true,
                  pomodoroBoostExpiresAt: result.boostExpiresAt
                });
              }
            } else if (result.alreadyClaimed) {
              console.log('[DailyGift] Gift already claimed today (verified by server)');
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
      console.log('[DailyGift] Auto-closing modal');
      onClose();
    }, 3000);

    return () => {
      clearTimeout(closeTimer);
    };
    // Only re-run when show or currentDay changes, not when gifts/xpAwarded changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, currentDay]);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          {/* Background overlay with purple tint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-b from-black/60 via-purple-900/20 to-black/70 backdrop-blur-sm pointer-events-none"
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
              className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 text-center mb-8 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
            >
              Daily Gift
            </motion.h2>

            {/* Grid of gifts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 max-w-3xl">
              {gifts.map((gift, index) => (
                <GiftCard
                  key={gift.id}
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
  const isSpecialRevealed = gift.type === 'special' && gift.isRevealed;
  const isAlreadyClaimed = gift.isRevealed && !gift.isSelected;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 400, damping: 15, bounce: 0.3 }}
      whileHover={{ scale: 1.05, rotate: 2 }}
      className={`
        relative aspect-square rounded-2xl
        transition-all duration-300
        ${gift.isSelected
          ? 'ring-2 ring-purple-400/80 shadow-[0_0_20px_rgba(168,85,247,0.6)]'
          : ''
        }
      `}
    >
      {/* Card background with gradient */}
      <div
        className={`
          absolute inset-0 rounded-2xl border border-white/10
          transition-all duration-300
          ${isSpecialRevealed
            ? 'bg-gradient-to-br from-red-400 via-red-500 to-rose-500'
            : 'bg-gradient-to-br from-purple-600/40 via-purple-700/50 to-pink-700/40'
          }
          ${gift.isSelected && !isSpecialRevealed
            ? 'bg-gradient-to-br from-purple-500/50 via-pink-600/50 to-purple-600/50'
            : ''
          }
        `}
      />

      {/* Gray overlay for already claimed rewards */}
      {isAlreadyClaimed && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-800/60 via-gray-700/50 to-gray-900/60 backdrop-blur-sm border border-white/5" />
      )}

      {/* Glow effect for special gift */}
      {isSpecialRevealed && (
        <>
          <motion.div
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="absolute inset-0 rounded-2xl bg-gradient-radial from-red-400/70 via-rose-500/50 to-transparent blur-2xl"
          />
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-300 via-red-500 to-rose-600 opacity-50"
          />
        </>
      )}

      {/* Shine animation for unclaimed gifts */}
      {!gift.isRevealed && !isAlreadyClaimed && (
        <motion.div
          className="absolute inset-0 rounded-2xl opacity-20"
          animate={{
            backgroundImage: [
              'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
            ],
            backgroundPosition: ['-200% 0', '200% 0'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{ backgroundSize: '200% 100%' }}
        />
      )}

      {/* Card content */}
      <div className="relative h-full flex items-center justify-center">
        {/* Unrevealed gifts show tomato icon */}
        {!gift.isRevealed && (
          <span className="text-5xl opacity-80">🍅</span>
        )}

        {/* Already claimed gifts show checkmark */}
        {isAlreadyClaimed && (
          <span className="text-4xl opacity-40">✓</span>
        )}

        {/* Current day XP gifts show the value */}
        {gift.type === 'xp' && gift.isRevealed && gift.isSelected && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400 text-2xl font-extrabold drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]"
          >
            {gift.value}
          </motion.span>
        )}

        {/* Current day special tomato gift with animation */}
        {gift.type === 'special' && gift.isRevealed && gift.isSelected && (
          <div className="flex flex-col items-center justify-center gap-2">
            <motion.span
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 1
              }}
              className="text-5xl"
            >
              {gift.value}
            </motion.span>
            {gift.description && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-white text-xs font-semibold text-center px-2"
              >
                {gift.description}
              </motion.p>
            )}
          </div>
        )}

        {/* Current day gift boxes show gift emoji with golden glow */}
        {gift.type === 'gift' && gift.isRevealed && gift.isSelected && (
          <div className="relative">
            <motion.div
              className="absolute inset-0 blur-2xl"
              animate={{
                opacity: [0.4, 0.7, 0.4],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                background: 'radial-gradient(circle, rgba(252,211,77,0.6) 0%, transparent 70%)',
              }}
            />
            <motion.span
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-5xl relative z-10"
            >
              {gift.value}
            </motion.span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
