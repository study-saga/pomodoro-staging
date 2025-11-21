import { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ROLE_EMOJI_ELF, ROLE_EMOJI_HUMAN } from '../../data/levels';

export const RoleSwitchComparison = () => {
  const [isOpen1, setIsOpen1] = useState(false);
  const [isOpen2, setIsOpen2] = useState(false);
  const { levelPath, setLevelPath } = useSettingsStore();

  const idleTimerRef1 = useRef<number | null>(null);
  const actionTimerRef1 = useRef<number | null>(null);
  const idleTimerRef2 = useRef<number | null>(null);
  const actionTimerRef2 = useRef<number | null>(null);

  // Version 1 handlers
  const handleMouseEnter1 = () => {
    if (!isOpen1) {
      setIsOpen1(true);
      if (idleTimerRef1.current) clearTimeout(idleTimerRef1.current);
      idleTimerRef1.current = setTimeout(() => setIsOpen1(false), 5000);
    }
  };

  const handleRoleChange1 = (newRole: 'elf' | 'human') => {
    setLevelPath(newRole);
    if (idleTimerRef1.current) clearTimeout(idleTimerRef1.current);
    if (actionTimerRef1.current) clearTimeout(actionTimerRef1.current);
    actionTimerRef1.current = setTimeout(() => setIsOpen1(false), 5000);
  };

  // Version 2 handlers
  const handleMouseEnter2 = () => {
    if (!isOpen2) {
      setIsOpen2(true);
      if (idleTimerRef2.current) clearTimeout(idleTimerRef2.current);
      idleTimerRef2.current = setTimeout(() => setIsOpen2(false), 5000);
    }
  };

  const handleRoleChange2 = (newRole: 'elf' | 'human') => {
    setLevelPath(newRole);
    if (idleTimerRef2.current) clearTimeout(idleTimerRef2.current);
    if (actionTimerRef2.current) clearTimeout(actionTimerRef2.current);
    actionTimerRef2.current = setTimeout(() => setIsOpen2(false), 5000);
  };

  useEffect(() => {
    return () => {
      if (idleTimerRef1.current) clearTimeout(idleTimerRef1.current);
      if (actionTimerRef1.current) clearTimeout(actionTimerRef1.current);
      if (idleTimerRef2.current) clearTimeout(idleTimerRef2.current);
      if (actionTimerRef2.current) clearTimeout(actionTimerRef2.current);
    };
  }, []);

  return (
    <div className="fixed top-[240px] right-4 z-40 flex flex-col gap-4">
      {/* Label */}
      <div className="text-white text-xs bg-black/50 px-2 py-1 rounded">
        Version 1: Elegant Purple/Pink
      </div>

      {/* VERSION 1: Elegant Purple/Pink */}
      <label
        className="relative inline-block cursor-pointer group"
        onMouseEnter={handleMouseEnter1}
        style={{
          width: isOpen1 ? '140px' : '44px',
          height: '44px',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <input
          type="checkbox"
          className="opacity-0 w-0 h-0 peer"
          checked={levelPath === 'human'}
          onChange={(e) => handleRoleChange1(e.target.checked ? 'human' : 'elf')}
        />

        <span
          className="absolute inset-0 rounded-full transition-all duration-400 flex items-center justify-center backdrop-blur-md"
          style={{
            background: `linear-gradient(135deg, #a855f7 0%, #ec4899 100%)`,
            boxShadow: isOpen1
              ? '0 8px 32px rgba(168, 85, 247, 0.4)'
              : '0 4px 16px rgba(168, 85, 247, 0.25)',
          }}
        >
          {!isOpen1 && (
            <span
              className="text-xl text-white transition-all duration-300"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
            >
              🔔
            </span>
          )}
        </span>

        <span
          className="absolute top-1 left-0 w-full h-full rounded-full transition-all duration-500 -z-10"
          style={{
            background: `linear-gradient(135deg, #a855f7 0%, #ec4899 100%)`,
            filter: 'blur(20px)',
            opacity: isOpen1 ? 0.6 : 0,
            transform: isOpen1 ? 'scale(1.1)' : 'scale(0.9)'
          }}
        />

        <span
          className="absolute bg-white rounded-full transition-all duration-400 flex items-center justify-center shadow-lg"
          style={{
            top: '3px',
            left: isOpen1
              ? (levelPath === 'human' ? 'calc(100% - 41px)' : '3px')
              : '50%',
            transform: !isOpen1 ? 'translateX(-50%)' : 'none',
            width: '38px',
            height: '38px',
            opacity: isOpen1 ? 1 : 0,
            pointerEvents: isOpen1 ? 'auto' : 'none',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <span className="text-lg">
            {levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN}
          </span>
        </span>
      </label>

      {/* Label */}
      <div className="text-white text-xs bg-black/50 px-2 py-1 rounded">
        Version 2: UI Matching Dark
      </div>

      {/* VERSION 2: UI Matching Dark */}
      <label
        className="relative inline-block cursor-pointer group"
        onMouseEnter={handleMouseEnter2}
        style={{
          width: isOpen2 ? '160px' : '50px',
          height: '50px',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <input
          type="checkbox"
          className="opacity-0 w-0 h-0 peer"
          checked={levelPath === 'human'}
          onChange={(e) => handleRoleChange2(e.target.checked ? 'human' : 'elf')}
        />

        <span
          className="absolute inset-0 rounded-2xl transition-all duration-400 flex items-center justify-center backdrop-blur-xl border border-white/10"
          style={{
            background: 'rgba(17, 24, 39, 0.95)',
            boxShadow: isOpen2
              ? '0 10px 25px rgba(0, 0, 0, 0.3)'
              : '0 4px 10px rgba(0, 0, 0, 0.2)',
          }}
        >
          {!isOpen2 && (
            <span
              className="text-xl text-white transition-all duration-300"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
            >
              🔔
            </span>
          )}
        </span>

        <span
          className="absolute rounded-2xl transition-all duration-400 flex items-center justify-center shadow-lg border border-white/10"
          style={{
            top: '4px',
            left: isOpen2
              ? (levelPath === 'human' ? 'calc(100% - 46px)' : '4px')
              : '50%',
            transform: !isOpen2 ? 'translateX(-50%)' : 'none',
            width: '42px',
            height: '42px',
            opacity: isOpen2 ? 1 : 0,
            pointerEvents: isOpen2 ? 'auto' : 'none',
            background: levelPath === 'human'
              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
              : 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <span className="text-xl">
            {levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN}
          </span>
        </span>
      </label>
    </div>
  );
};
