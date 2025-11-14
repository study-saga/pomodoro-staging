import { useState } from 'react';
import { LevelUpCelebration } from '../components/level/LevelUpCelebration';

export default function LevelUpTest() {
  const [showCelebration, setShowCelebration] = useState(false);
  const [level, setLevel] = useState(25);
  const [levelName, setLevelName] = useState('Grandmaster Scholar');

  const triggerCelebration = () => {
    setShowCelebration(true);
    setTimeout(() => {
      setShowCelebration(false);
    }, 10000); // Auto-hide after 10 seconds
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Level Up Celebration Test
          </h1>
          <p className="text-white/70 text-lg">
            Test the level-up celebration with forest backgrounds
          </p>
        </div>

        {/* Controls */}
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-8 border border-white/10 space-y-6">
          <div className="space-y-4">
            {/* Level Input */}
            <div>
              <label className="block text-white font-medium mb-2">Level</label>
              <input
                type="number"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
                min="1"
                max="100"
              />
            </div>

            {/* Level Name Input */}
            <div>
              <label className="block text-white font-medium mb-2">Level Name</label>
              <input
                type="text"
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
                placeholder="Enter level name"
              />
            </div>

            {/* Trigger Button */}
            <button
              onClick={triggerCelebration}
              className="w-full px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xl transition-colors shadow-lg"
            >
              🎉 Trigger Level Up Celebration
            </button>
          </div>

          {/* Info */}
          <div className="pt-6 border-t border-white/10">
            <p className="text-white/60 text-sm text-center">
              Each trigger will show a random forest background from the 8 available variants
            </p>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            ← Back to App
          </a>
        </div>
      </div>

      {/* Level Up Celebration Component */}
      <LevelUpCelebration
        show={showCelebration}
        level={level}
        levelName={levelName}
      />
    </div>
  );
}
