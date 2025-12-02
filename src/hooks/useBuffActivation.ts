/**
 * Auto-activate event buffs based on date/conditions
 */

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettingsStore } from '../store/useSettingsStore';
import { setUserBuff } from '../lib/buffManager';

export function useBuffActivation() {
  const { appUser } = useAuth();
  const { levelPath, activeBuffs, settingsSyncComplete } = useSettingsStore();

  useEffect(() => {
    // Wait for settings to sync from database
    if (!settingsSyncComplete || !appUser?.id) return;

    // Check if slingshot buff should be activated (Nov 22+, elf only)
    const activateSlingshotIfNeeded = async () => {
      // Only for elves
      if (levelPath !== 'elf') return;

      // Check if already active
      if (activeBuffs.slingshot_nov22) {
        console.log('[BuffActivation] Slingshot buff already active');
        return;
      }

      // Check date (UTC-based)
      const now = Date.now();
      const startDate = Date.UTC(2025, 10, 22); // Nov 22 00:00 UTC (month is 0-indexed)

      if (now < startDate) {
        console.log('[BuffActivation] Slingshot buff not yet available (activates Nov 22 UTC)');
        return;
      }

      console.log('[BuffActivation] Auto-activating slingshot buff for elf');

      try {
        // Activate in database
        await setUserBuff(
          appUser.id,
          'slingshot_nov22',
          0.25, // +25%
          null, // No expiration (permanent event)
          { autoActivatedAt: Date.now() },
          appUser.discord_id // Pass Discord ID for dual-auth
        );

        // Update local state
        useSettingsStore.setState({
          activeBuffs: {
            ...activeBuffs,
            slingshot_nov22: {
              value: 0.25,
              expiresAt: null,
              metadata: { autoActivatedAt: Date.now() }
            }
          }
        });

        console.log('[BuffActivation] ✓ Slingshot buff activated');
      } catch (error) {
        console.error('[BuffActivation] Failed to activate slingshot buff:', error);
      }
    };

    activateSlingshotIfNeeded();
  }, [appUser?.id, levelPath, settingsSyncComplete]);
}
