import { useMemo, useEffect, useState } from 'react';
import { EVENT_BUFFS, getActiveBuffs, getUpcomingBuffs } from '../data/eventBuffsData';
import type { EventBuff } from '../types';

/**
 * Hook: Get currently active event buffs
 * Updates automatically as date changes
 *
 * @param levelPath - User's current role ('elf' | 'human')
 * @param refreshInterval - How often to check for date changes (default: 60000ms = 1 minute)
 * @returns activeBuffs array, upcomingBuffs array, and total multiplier
 */
export function useActiveEventBuffs(levelPath: 'elf' | 'human', refreshInterval: number = 60000) {
  const [activeBuffs, setActiveBuffs] = useState<EventBuff[]>([]);
  const [upcomingBuffs, setUpcomingBuffs] = useState<EventBuff[]>([]);

  useEffect(() => {
    const updateBuffs = () => {
      const allActiveBuffs = getActiveBuffs(new Date());
      const allUpcomingBuffs = getUpcomingBuffs(48, new Date());

      // Filter role-specific buffs
      const filterByRole = (buffs: EventBuff[]) => buffs.filter(buff => {
        // Check if buff description contains "(Elf only)" or "(Human only)"
        if (buff.description.includes('(Elf only)')) {
          return levelPath === 'elf';
        }
        if (buff.description.includes('(Human only)')) {
          return levelPath === 'human';
        }
        // Otherwise, buff applies to all roles
        return true;
      });

      setActiveBuffs(filterByRole(allActiveBuffs));
      setUpcomingBuffs(filterByRole(allUpcomingBuffs));
    };

    updateBuffs();

    // Re-check every minute (or custom interval) to detect date changes
    const interval = setInterval(updateBuffs, refreshInterval);
    return () => clearInterval(interval);
  }, [levelPath, refreshInterval]);

  const totalMultiplier = useMemo(() => {
    return activeBuffs.reduce((total, buff) => total * buff.xpMultiplier, 1);
  }, [activeBuffs]);

  return { activeBuffs, upcomingBuffs, totalMultiplier };
}

/**
 * Hook: Get specific buff details by ID
 */
export function useBuffDetails(buffId: string) {
  return useMemo(() => {
    return EVENT_BUFFS.find((buff) => buff.id === buffId);
  }, [buffId]);
}
