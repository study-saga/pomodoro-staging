import { useEffect, useRef, useState } from 'react';

interface Arrow {
  id: number;
  x: number;
  y: number;
}

interface SkeletonArcherProps {
  onAnimationComplete?: () => void;
  autoPlay?: boolean;
  loop?: boolean;
}

export default function SkeletonArcher({
  onAnimationComplete,
  autoPlay = true,
  loop = false
}: SkeletonArcherProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [isAnimating, setIsAnimating] = useState(autoPlay);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastFrameTimeRef = useRef<number>(0);
  const arrowIdRef = useRef(0);

  // Sprite sheet configuration
  const TOTAL_FRAMES = 15;
  const FRAME_WIDTH = 128; // Width per frame (1920px / 15 frames)
  const FRAME_HEIGHT = 128; // Height of sprite sheet
  const FRAME_DURATION = 80; // ms per frame
  const ARROW_SPEED = 200; // pixels per second
  const ARROW_DISTANCE = 100; // pixels to travel
  const ARROW_SPAWN_FRAME = 13; // Frame when arrow should spawn (near end of animation)

  useEffect(() => {
    if (!isAnimating) return;

    const animate = (timestamp: number) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;

      if (elapsed >= FRAME_DURATION) {
        setCurrentFrame(prev => {
          const nextFrame = prev + 1;

          // Spawn arrow on specific frame
          if (nextFrame === ARROW_SPAWN_FRAME) {
            const newArrow: Arrow = {
              id: arrowIdRef.current++,
              x: 0,
              y: 0,
            };
            setArrows(prevArrows => [...prevArrows, newArrow]);
          }

          // Check if animation is complete
          if (nextFrame >= TOTAL_FRAMES) {
            if (loop) {
              return 0; // Loop back to start
            } else {
              setIsAnimating(false);
              onAnimationComplete?.();
              return prev; // Stay on last frame
            }
          }

          return nextFrame;
        });

        lastFrameTimeRef.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, loop, onAnimationComplete]);

  // Clean up arrows that have finished traveling
  useEffect(() => {
    const timer = setTimeout(() => {
      setArrows(prevArrows =>
        prevArrows.filter(arrow => arrow.x < ARROW_DISTANCE + 50)
      );
    }, (ARROW_DISTANCE / ARROW_SPEED) * 1000 + 500);

    return () => clearTimeout(timer);
  }, [arrows.length]);

  const handlePlay = () => {
    setCurrentFrame(0);
    setArrows([]);
    setIsAnimating(true);
    lastFrameTimeRef.current = 0;
  };

  const backgroundPositionX = -(currentFrame * FRAME_WIDTH);

  return (
    <div className="relative inline-block">
      {/* Skeleton Archer Sprite */}
      <div
        className="relative"
        style={{
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
          backgroundImage: 'url(/sprites/skeleton_shot.png)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${backgroundPositionX}px 0`,
          imageRendering: 'pixelated',
        }}
      >
        {/* Arrows */}
        {arrows.map(arrow => (
          <div
            key={arrow.id}
            className="absolute"
            style={{
              width: 32,
              height: 32,
              backgroundImage: 'url(/sprites/arrow.png)',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
              top: '60%',
              left: '75%',
              transform: 'translateX(-50%) translateY(-50%)',
              animation: `fly-arrow ${(ARROW_DISTANCE / ARROW_SPEED)}s linear forwards`,
            }}
          />
        ))}
      </div>

      {/* CSS Animation for Arrow */}
      <style>{`
        @keyframes fly-arrow {
          from {
            transform: translateX(0) translateY(-50%);
            opacity: 1;
          }
          to {
            transform: translateX(120px) translateY(-50%);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
