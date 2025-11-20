import { useState } from 'react';
import SkeletonArcher from './SkeletonArcher';

export default function SkeletonArcherDemo() {
  const [autoPlay, setAutoPlay] = useState(false);
  const [loop, setLoop] = useState(false);
  const [scale, setScale] = useState(2);
  const [completionCount, setCompletionCount] = useState(0);

  const handleAnimationComplete = () => {
    setCompletionCount(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Skeleton Archer Demo
          </h1>
          <p className="text-white/70 text-lg">
            Interactive sprite animation with projectile system
          </p>
        </div>

        {/* Main Demo Area */}
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-12 border border-white/10 mb-8">
          <div className="flex justify-center items-center min-h-[200px]">
            <div style={{ transform: `scale(${scale})` }}>
              <SkeletonArcher
                autoPlay={autoPlay}
                loop={loop}
                onAnimationComplete={handleAnimationComplete}
              />
            </div>
          </div>

          {/* Animation Stats */}
          <div className="mt-8 text-center">
            <p className="text-white/60 text-sm">
              Animation completed: <span className="text-white font-bold">{completionCount}</span> times
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6">Controls</h2>

          <div className="space-y-6">
            {/* Auto Play Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-white font-medium">Auto Play</label>
              <button
                onClick={() => setAutoPlay(!autoPlay)}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  autoPlay
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                {autoPlay ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Loop Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-white font-medium">Loop Animation</label>
              <button
                onClick={() => setLoop(!loop)}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  loop
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                {loop ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Scale Slider */}
            <div className="flex items-center justify-between">
              <label className="text-white font-medium">Scale: {scale.toFixed(1)}x</label>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.5"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-64 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Reset Button */}
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setCompletionCount(0);
                  setAutoPlay(false);
                  setLoop(false);
                  setScale(2);
                }}
                className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-black/30 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">Animation Details</h2>
          <div className="grid grid-cols-2 gap-4 text-white/70">
            <div>
              <p className="font-medium text-white mb-1">Total Frames</p>
              <p>15 frames</p>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Frame Duration</p>
              <p>80ms per frame</p>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Arrow Distance</p>
              <p>100 pixels</p>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Arrow Spawn Frame</p>
              <p>Frame 13</p>
            </div>
          </div>
        </div>

        {/* Back to App Button */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-block px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            ← Back to Pomodoro App
          </a>
        </div>
      </div>
    </div>
  );
}
