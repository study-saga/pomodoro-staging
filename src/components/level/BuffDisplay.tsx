import { memo } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { calculateBuffStack } from '../../lib/buffManager';
import { getRoleConfig } from '../../data/roleSystem';
import buffElf from '../../assets/buff-elf.svg';
import buffHuman from '../../assets/buff-human.svg';
import buffElfSlingshot from '../../assets/buff-elf-slingshot.svg';
import buffBoost from '../../assets/buff-boost.svg';

interface BuffDisplayProps {
  className?: string;
}

export const BuffDisplay = memo(function BuffDisplay({ className = '' }: BuffDisplayProps) {
  const { levelPath, activeBuffs } = useSettingsStore();

  // Calculate stacked buffs
  const buffStack = calculateBuffStack(activeBuffs, levelPath);

  // Get role config for permanent buffs
  const roleConfig = getRoleConfig(levelPath);
  const permanentBuffs = roleConfig.buffs.filter(b => b.category === 'permanent');

  // Get buff icon
  const getBuffIcon = (buffId: string) => {
    switch (buffId) {
      case 'day10_boost':
        return buffBoost;
      case 'slingshot_nov22':
        return buffElfSlingshot;
      default:
        return levelPath === 'elf' ? buffElf : buffHuman;
    }
  };

  // Calculate total XP bonus (permanent + event)
  const permanentXPBonus = roleConfig.stats.xpBonus || 0;
  const eventXPBonus = (buffStack.totalXPMultiplier - 1) * 100; // Convert to percentage
  const totalXPBonus = permanentXPBonus + eventXPBonus;

  return (
    <div className={`fixed top-20 left-4 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 p-4 min-w-[200px] max-w-[280px] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Active Buffs</h3>
        {totalXPBonus > 0 && (
          <div className="px-2 py-0.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-purple-500/30">
            <span className="text-xs font-bold text-purple-300">
              +{totalXPBonus.toFixed(1)}% XP
            </span>
          </div>
        )}
      </div>

      {/* Buffs List */}
      <div className="space-y-2">
        {/* Permanent Role Buffs */}
        {permanentBuffs.map((buff) => (
          <div
            key={buff.id}
            className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10"
          >
            <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
              <span className="text-lg">{buff.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{buff.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{buff.description}</p>
            </div>
          </div>
        ))}

        {/* Event Buffs */}
        {buffStack.activeBuffs.length > 0 && (
          <>
            {buffStack.activeBuffs.map((buff) => {
              const buffData = activeBuffs[buff.id];
              const isExpiring = buffData?.expiresAt ? buffData.expiresAt - Date.now() < 60 * 60 * 1000 : false; // < 1 hour

              return (
                <div
                  key={buff.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    isExpiring
                      ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30 animate-pulse'
                      : 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30'
                  }`}
                >
                  <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center ${
                    isExpiring
                      ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500'
                      : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500'
                  }`}>
                    <img
                      src={getBuffIcon(buff.id)}
                      alt={buff.name}
                      className="w-full h-full object-cover"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.5))' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${
                      isExpiring ? 'text-yellow-300' : 'text-green-300'
                    }`}>
                      {buff.name}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {buffData?.expiresAt ? (
                        <>
                          Expires: {Math.floor((buffData.expiresAt - Date.now()) / (1000 * 60 * 60))}h{' '}
                          {Math.floor(((buffData.expiresAt - Date.now()) % (1000 * 60 * 60)) / (1000 * 60))}m
                        </>
                      ) : (
                        'Permanent'
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* No Active Event Buffs Message */}
        {permanentBuffs.length === 0 && buffStack.activeBuffs.length === 0 && (
          <div className="text-center py-4">
            <p className="text-xs text-gray-500">No active buffs</p>
          </div>
        )}
      </div>

      {/* Footer - Total Summary */}
      {(permanentBuffs.length > 0 || buffStack.activeBuffs.length > 0) && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Total Buffs:</span>
            <span className="font-bold text-white">
              {permanentBuffs.length + buffStack.activeBuffs.length}
            </span>
          </div>
          {buffStack.bonusStrings.length > 0 && (
            <div className="mt-1">
              {buffStack.bonusStrings.map((bonus, idx) => (
                <p key={idx} className="text-[10px] text-purple-400">
                  {bonus}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
