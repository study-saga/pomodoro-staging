import { useCallback } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { toast } from 'sonner';
import { ROLE_EMOJI_ELF, ROLE_EMOJI_HUMAN } from '../data/levels';

const ROLE_MESSAGES = {
  elf: [
    "The ancient woods welcome your return.",
    "Wisdom flows through you once more.",
    "The spirits of nature guide your path.",
    "Elven grace awakens within you.",
    "The moonlight reveals your true form.",
    "Ancient magic stirs in your veins.",
    "The forest recognizes one of its own.",
    "Balance and harmony shall be yours.",
  ],
  human: [
    "Forge your own destiny with iron will.",
    "The fire of ambition burns within you.",
    "Strength and resolve define your path.",
    "Rise to meet every challenge ahead.",
    "Your determination knows no limits.",
    "The spirit of warriors guides you now.",
    "Courage shall light your darkest hours.",
    "Stand tall. Your legend begins today.",
  ],
};

export function useRoleChange() {
  const { levelPath, setLevelPath } = useSettingsStore();

  const handleRoleChange = useCallback((newRole: 'elf' | 'human') => {
    // Only show message if role is actually changing
    if (newRole === levelPath) return;

    setLevelPath(newRole);

    const randomMessage = ROLE_MESSAGES[newRole][Math.floor(Math.random() * ROLE_MESSAGES[newRole].length)];
    const emoji = newRole === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN;

    toast.custom(() => (
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-lg shadow-2xl border-2 border-white/20 w-80">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{emoji}</span>
          <div className="flex-1">
            <p className="font-bold text-sm mb-1">Role Changed!</p>
            <p className="text-sm leading-relaxed">{randomMessage}</p>
          </div>
        </div>
      </div>
    ), {
      duration: 4000,
      position: 'bottom-right',
    });
  }, [levelPath, setLevelPath]);

  return { handleRoleChange, levelPath };
}
