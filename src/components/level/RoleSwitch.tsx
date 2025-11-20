import { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ROLE_EMOJI_ELF, ROLE_EMOJI_HUMAN } from '../../data/levels';
import './RoleSwitch.css';

export const RoleSwitch = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { levelPath, setLevelPath } = useSettingsStore();

  // Refs to store timer IDs for cleanup
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const actionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handler: When user hovers over the element
  const handleMouseEnter = () => {
    if (!isOpen) {
      setIsOpen(true);
      startIdleTimer(); // Start the 30s countdown
    }
  };

  // Timer 1: Idle Timer (30 seconds)
  // Closes the menu if no action is taken for 30s
  const startIdleTimer = () => {
    clearTimers(); // Clear any existing timers
    idleTimerRef.current = setTimeout(() => {
      console.log("Time's up! Closing due to inactivity (30s).");
      setIsOpen(false);
    }, 30000);
  };

  // Timer 2: Action Timer (10 seconds)
  // Closes the menu 10s after a selection is made
  const handleRoleChange = (newRole: 'elf' | 'human') => {
    setLevelPath(newRole);

    // Clear the idle timer since the user interacted
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    // Reset any existing action timer
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);

    // Start the 10s close timer
    actionTimerRef.current = setTimeout(() => {
      console.log("Closing 10s after selection.");
      setIsOpen(false);
    }, 10000);
  };

  // Helper: Clear all running timers
  const clearTimers = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => clearTimers();
  }, []);

  return (
    <div className="fixed top-[240px] left-4 z-40">
      {/* Role Switch matching UI style */}
      <label
        className="relative inline-block cursor-pointer group"
        onMouseEnter={handleMouseEnter}
        style={{
          width: isOpen ? '160px' : '50px',
          height: '50px',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <input
          type="checkbox"
          className="opacity-0 w-0 h-0 peer"
          checked={levelPath === 'human'}
          onChange={(e) => handleRoleChange(e.target.checked ? 'human' : 'elf')}
        />

        {/* Background Track (matching gray-900/95 style) */}
        <span
          className="absolute inset-0 rounded-2xl transition-all duration-400 flex items-center justify-center backdrop-blur-xl border border-white/10"
          style={{
            background: 'rgba(17, 24, 39, 0.95)',
            boxShadow: isOpen
              ? '0 10px 25px rgba(0, 0, 0, 0.3)'
              : '0 4px 10px rgba(0, 0, 0, 0.2)',
          }}
        >
          {/* Icon when closed */}
          {!isOpen && (
            <span
              className="text-xl text-white transition-all duration-300"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
              }}
            >
              🔔
            </span>
          )}
        </span>

        {/* Slider Thumb */}
        <span
          className="absolute rounded-2xl transition-all duration-400 flex items-center justify-center shadow-lg border border-white/10"
          style={{
            top: '4px',
            left: isOpen
              ? (levelPath === 'human' ? 'calc(100% - 46px)' : '4px')
              : '50%',
            transform: !isOpen ? 'translateX(-50%)' : 'none',
            width: '42px',
            height: '42px',
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? 'auto' : 'none',
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
