import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';

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
  isRevealed: boolean;
  isSelected: boolean;
}

export function DailyGiftGrid({ show, onClose, currentDay }: DailyGiftGridProps) {
  const addDailyGiftXP = useSettingsStore((state) => state.addDailyGiftXP);

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
          xpAmount: 50 // 5x bonus
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

  // Auto-reveal current day's gift, award XP, and auto-close
  useEffect(() => {
    if (!show || currentDay < 1 || currentDay > 12) {
      return;
    }

    // Wait 0.5s for entrance animation, then reveal current day's gift
    const revealTimer = setTimeout(() => {
      setGifts(prev => prev.map(g => ({
        ...g,
        isRevealed: g.id <= currentDay,
      })));

      // Award XP for the current day's gift
      if (!xpAwarded) {
        const currentGift = gifts.find(g => g.id === currentDay);
        if (currentGift?.xpAmount) {
          // Award XP directly (no pomodoro creation)
          addDailyGiftXP(currentGift.xpAmount);
          setXpAwarded(true);
          console.log(`[DailyGift] Awarded ${currentGift.xpAmount} XP for day ${currentDay}`);
        }
      }
    }, 500);

    // Auto-close after 3 seconds total (give user time to see the reward)
    const closeTimer = setTimeout(() => {
      console.log('[DailyGift] Auto-closing modal');
      onClose();
    }, 3000);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(closeTimer);
    };
    // Only re-run when show or currentDay changes, not when gifts/xpAwarded changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, currentDay]);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          {/* Background overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none"
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
              className="text-4xl font-bold text-white text-center mb-8"
            >
              Daily Gift
            </motion.h2>

            {/* Grid of gifts */}
            <div className="grid grid-cols-6 gap-3 max-w-3xl">
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

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
      className={`
        relative aspect-square rounded-2xl
        transition-all duration-300
        ${gift.isSelected
          ? 'ring-4 ring-white ring-offset-2 ring-offset-transparent'
          : ''
        }
      `}
    >
      {/* Card background with gradient */}
      <div
        className={`
          absolute inset-0 rounded-2xl
          transition-all duration-300
          ${isSpecialRevealed
            ? 'bg-gradient-to-br from-red-400 via-red-500 to-rose-600'
            : 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900'
          }
          ${gift.isSelected && !isSpecialRevealed
            ? 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800'
            : ''
          }
        `}
      />

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
            className="absolute inset-0 rounded-2xl bg-red-500/50 blur-xl"
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

      {/* Card content */}
      <div className="relative h-full flex items-center justify-center">
        {/* Unrevealed gifts show tomato icon */}
        {!gift.isRevealed && (
          <span className="text-5xl opacity-80">🍅</span>
        )}

        {/* Revealed XP gifts show the value */}
        {gift.type === 'xp' && gift.isRevealed && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-white text-xl font-bold"
          >
            {gift.value}
          </motion.span>
        )}

        {/* Special tomato gift with animation when revealed */}
        {gift.type === 'special' && gift.isRevealed && (
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
        )}

        {/* Revealed gift boxes show gift emoji */}
        {gift.type === 'gift' && gift.isRevealed && (
          <motion.span
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="text-5xl"
          >
            {gift.value}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}
