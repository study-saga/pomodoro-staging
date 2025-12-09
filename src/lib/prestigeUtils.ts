/**
 * Prestige Display Utilities
 *
 * Role-based prestige system with tiered progression:
 * - Tier 1 (Stars): Role-specific SVG icons (elf/human)
 * - Tier 2 (Crowns 👑): 5 stars = 1 crown
 * - Tier 3 (Diamonds 💎): 5 crowns = 1 diamond (25 stars)
 * - Tier 4 (Gems 💠): 5 diamonds = 1 gem (125 stars)
 * - Each star remembers which role earned it
 */

import type { PrestigeStar } from '../types';
// SVG imports removed - referencing public assets directly
// import starElfSvg from '../assets/star-elf.svg';
// import starHumanSvg from '../assets/star-human.svg';

// Icon types
export type PrestigeIcon = {
  type: 'svg' | 'emoji';
  value: string;
  role?: 'elf' |
  'human';
  tier: 'star' | 'crown' | 'diamond' | 'gem';
};

// Role-specific star SVG paths (referencing public/assets/buffs)
export const STAR_SVGS = {
  elf: '/assets/buffs/star-elf.svg',
  human: '/assets/buffs/star-human.svg',
} as const;

const CROWN_ICON = '👑';
const DIAMOND_ICON = '💎';
const GEM_ICON = '💠';

/**
 * Get prestige icons array for rendering (supports SVG + emoji)
 */
export function getPrestigeIcons(prestigeStars: PrestigeStar[]): PrestigeIcon[] {
  if (!prestigeStars || prestigeStars.length === 0) return [];

  const starCount = prestigeStars.length;
  const icons: PrestigeIcon[] = [];

  // Tier 4: Gems (125+ stars)
  if (starCount >= 125) {
    const gems = Math.floor(starCount / 125);
    for (let i = 0; i < gems; i++) {
      icons.push({ type: 'emoji', value: GEM_ICON, tier: 'gem' });
    }
  }

  // Tier 3: Diamonds (25+ stars)
  const remainingAfterGems = starCount % 125;
  if (remainingAfterGems >= 25) {
    const diamonds = Math.floor(remainingAfterGems / 25);
    for (let i = 0; i < diamonds; i++) {
      icons.push({ type: 'emoji', value: DIAMOND_ICON, tier: 'diamond' });
    }
  }

  // Tier 2: Crowns (5+ stars)
  const remainingAfterDiamonds = remainingAfterGems % 25;
  if (remainingAfterDiamonds >= 5) {
    const crowns = Math.floor(remainingAfterDiamonds / 5);
    for (let i = 0; i < crowns; i++) {
      icons.push({ type: 'emoji', value: CROWN_ICON, tier: 'crown' });
    }
  }

  // Tier 1: Stars (remaining) - SVG icons
  const remainingStars = remainingAfterDiamonds % 5;
  if (remainingStars > 0) {
    const lastStars = prestigeStars.slice(-remainingStars);
    lastStars.forEach(star => {
      icons.push({
        type: 'svg',
        value: STAR_SVGS[star.role],
        role: star.role,
        tier: 'star'
      });
    });
  }

  return icons;
}

/**
 * Get prestige display string (legacy - for text display only)
 */
export function getPrestigeDisplay(prestigeStars: PrestigeStar[]): string {
  const icons = getPrestigeIcons(prestigeStars);
  return icons.map(icon => icon.type === 'emoji' ? icon.value : '⭐').join('');
}

/**
 * Legacy function for backward compatibility with numeric prestige level
 * Creates generic stars based on prestige number
 */
export function getPrestigeDisplayLegacy(prestigeLevel: number): string {
  if (prestigeLevel === 0) return '';

  const symbols = ['⭐', '👑', '💎', '💠'];
  const result: string[] = [];

  // Calculate each tier (reversed for display order: gems → diamonds → crowns → stars)
  for (let tier = 3; tier >= 0; tier--) {
    const divisor = Math.pow(5, tier);
    const count = Math.floor(prestigeLevel / divisor) % 5;

    if (count > 0) {
      result.push(symbols[tier].repeat(count));
    }
  }

  return result.join('');
}

/**
 * Get description of prestige stars earned with tiered display
 */
export function getPrestigeDescription(prestigeStars: PrestigeStar[]): string {
  if (!prestigeStars || prestigeStars.length === 0) {
    return 'No prestige stars yet';
  }

  const starCount = prestigeStars.length;
  const parts: string[] = [];

  // Gems
  const gems = Math.floor(starCount / 125);
  if (gems > 0) parts.push(`${gems} Gem${gems > 1 ? 's' : ''}`);

  // Diamonds
  const remainingAfterGems = starCount % 125;
  const diamonds = Math.floor(remainingAfterGems / 25);
  if (diamonds > 0) parts.push(`${diamonds} Diamond${diamonds > 1 ? 's' : ''}`);

  // Crowns
  const remainingAfterDiamonds = remainingAfterGems % 25;
  const crowns = Math.floor(remainingAfterDiamonds / 5);
  if (crowns > 0) parts.push(`${crowns} Crown${crowns > 1 ? 's' : ''}`);

  // Stars
  const stars = remainingAfterDiamonds % 5;
  if (stars > 0) parts.push(`${stars} Star${stars > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(' + ') : `${starCount} Prestige Star${starCount !== 1 ? 's' : ''}`;
}
