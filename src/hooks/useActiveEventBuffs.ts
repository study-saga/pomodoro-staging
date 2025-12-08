import { useMemo, useEffect, useState } from 'react';
import { EVENT_BUFFS, getUpcomingBuffs } from '../data/eventBuffsData';
import type { EventBuff } from '../types';
import { isBuffActiveSecure } from '../config/buffActivationRules';

/**
 * Hook: Get currently active event buffs with server-authoritative validation
 * Updates automatically as date changes
 *
 * SECURITY: Uses server-side timezone check for weekend buffs (prevents client manipulation)
 *
 * @param userId - User ID (null for guest mode)
 * @param levelPath - User's current role ('elf' | 'human')
 * @param refreshInterval - How often to check for date changes (default: 60000ms = 1 minute)
 * @returns activeBuffs array, upcomingBuffs array, total multiplier, and loading state
 */
export function useActiveEventBuffs(
  userId: string | null,
  levelPath: 'elf' | 'human',
  refreshInterval: number = 60000
) {
  const [activeBuffs, setActiveBuffs] = useState<EventBuff[]>([]);
  const [upcomingBuffs, setUpcomingBuffs] = useState<EventBuff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateBuffs = async () => {
      setIsLoading(true);

      try {
        // Check each buff with server-authoritative validation
        const activePromises = EVENT_BUFFS.map(buff => isBuffActiveSecure(buff, userId));
        const activeResults = await Promise.all(activePromises);

        const allActiveBuffs = EVENT_BUFFS.filter((_, index) => activeResults[index]);
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
      } catch (error) {
        console.error('[useActiveEventBuffs] Error updating buffs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    updateBuffs();

    // Re-check every minute (or custom interval) to detect date changes
    const interval = setInterval(updateBuffs, refreshInterval);
    return () => clearInterval(interval);
  }, [userId, levelPath, refreshInterval]);

  const totalMultiplier = useMemo(() => {
    return activeBuffs.reduce((total, buff) => total * buff.xpMultiplier, 1);
  }, [activeBuffs]);

  return { activeBuffs, upcomingBuffs, totalMultiplier, isLoading };
}

/**
 * Hook: Get specific buff details by ID
 */
export function useBuffDetails(buffId: string) {
  return useMemo(() => {
    return EVENT_BUFFS.find((buff) => buff.id === buffId);
  }, [buffId]);
}
