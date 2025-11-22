import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import SkeletonArcher from '../SkeletonArcher';

interface LevelUpCelebrationProps {
  show: boolean;
  level: number;
  levelName: string;
}

export function LevelUpCelebration({ show, level, levelName }: LevelUpCelebrationProps) {
  const [backgroundImage, setBackgroundImage] = useState('');

  // Select random forest background when celebration shows
  useEffect(() => {
    if (show) {
      const randomBg = Math.floor(Math.random() * 8) + 1;
      setBackgroundImage(`/forest-backgrounds/forest-${randomBg}.png`);
    }
  }, [show]);

  // Generate confetti particles
  const confettiParticles = Array.from({ length: 90 }, (_, i) => {
    const sizes = [
      { w: 6, h: 3 },   // small
      { w: 10, h: 5 },  // medium
      { w: 14, h: 7 },  // large
    ];
    const size = sizes[Math.floor(Math.random() * sizes.length)];

    return {
      id: i,
      color: ['#FCD34D', '#F59E0B', '#EF4444', '#EC4899'][Math.floor(Math.random() * 4)],
      delay: Math.random() * 0.3,
      x: (Math.random() - 0.5) * 400,
      y: (Math.random() - 0.5) * 400,
      rotation: Math.random() * 360,
      rotateX: Math.random() * 720,
      width: size.w,
      height: size.h,
    };
  });

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          {/* Background overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Main celebration box with forest background */}
          <motion.div
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: 180, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 20,
              duration: 0.6
            }}
            className="relative rounded-2xl shadow-2xl border-4 border-[#8B4513] overflow-hidden"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              minWidth: '500px',
              minHeight: '320px',
              imageRendering: 'pixelated'
            }}
          >
            {/* Dark overlay for better text visibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40 pointer-events-none" />

            {/* Content */}
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative z-10 text-center pt-6 px-8"
            >
              <motion.h2
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.2, 1] }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-5xl font-black text-[#FFD700] mb-4"
                style={{
                  textShadow: '0 0 20px rgba(255, 215, 0, 0.8), 0 4px 10px rgba(0,0,0,0.8), 0 0 40px rgba(255, 215, 0, 0.5)'
                }}
              >
                LEVEL UP!
              </motion.h2>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="space-y-1"
              >
                <p
                  className="text-3xl font-bold text-white"
                  style={{
                    textShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 2px 8px rgba(0,0,0,0.8)'
                  }}
                >
                  Level {level}
                </p>
                <p
                  className="text-xl text-[#FFD700]"
                  style={{
                    textShadow: '0 0 10px rgba(255, 215, 0, 0.6), 0 2px 8px rgba(0,0,0,0.8)'
                  }}
                >
                  {levelName}
                </p>
              </motion.div>
            </motion.div>

            {/* Skeleton Archer in bottom-left corner */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className="absolute bottom-6 left-6 z-20"
              style={{ transform: 'scale(1.1)' }}
            >
              <SkeletonArcher autoPlay={true} loop={false} />
            </motion.div>
          </motion.div>

          {/* Confetti particles */}
          {confettiParticles.map((particle) => (
            <motion.div
              key={`confetti-${particle.id}`}
              className="absolute"
              style={{
                width: `${particle.width}px`,
                height: `${particle.height}px`,
                backgroundColor: particle.color,
                borderRadius: '1px',
              }}
              initial={{
                x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
                y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
                opacity: 1,
                rotateZ: 0,
                rotateX: 0,
              }}
              animate={{
                x: typeof window !== 'undefined' ? window.innerWidth / 2 + particle.x : particle.x,
                y: typeof window !== 'undefined' ? window.innerHeight / 2 + particle.y : particle.y,
                opacity: [1, 1, 1, 1, 0],
                rotateZ: particle.rotation * 2,
                rotateX: particle.rotateX,
              }}
              transition={{
                duration: 5,
                delay: particle.delay,
                ease: [0.4, 0.0, 0.6, 1],
                opacity: {
                  duration: 5,
                  times: [0, 0.2, 0.8, 0.9, 1],
                  ease: 'easeOut',
                }
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
