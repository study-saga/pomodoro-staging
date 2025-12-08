import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateBuffStack, shouldAutoActivateSlingshot, type ActiveBuff } from '../buffManager';
import { supabase } from '../supabase';

// Mock Supabase
vi.mock('../supabase', () => ({
    supabase: {
        from: vi.fn(),
        rpc: vi.fn(),
    },
}));

// Mock roleSystem dependency
vi.mock('../../data/roleSystem', () => ({
    getEventBuff: (id: string) => {
        const mocks: Record<string, any> = {
            'test_buff': {
                id: 'test_buff',
                name: 'Test Buff',
                xpBonus: 0.15,
                roles: undefined // applies to all
            },
            'elf_only': {
                id: 'elf_only',
                name: 'Elf Buff',
                xpBonus: 0.20,
                roles: ['elf']
            },
            'slingshot_nov22': {
                id: 'slingshot_nov22',
                name: 'Slingshot',
                xpBonus: 0.25,
                roles: ['elf']
            },
        };
        return mocks[id];
    },
    eventBuffAppliesToRole: (buff: any, role: string) => {
        if (!buff.roles) return true;
        return buff.roles.includes(role);
    },
}));

describe('BuffManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('calculateBuffStack', () => {
        it('should return base multiplier 1.0 when no buffs active', () => {
            const result = calculateBuffStack({}, 'human');
            expect(result.totalXPMultiplier).toBe(1.0);
            expect(result.activeBuffs).toHaveLength(0);
        });

        it('should add active buff multiplier', () => {
            const activeBuffs: Record<string, ActiveBuff> = {
                'test_buff': { value: 0.15, expiresAt: null }
            };

            const result = calculateBuffStack(activeBuffs, 'human');
            expect(result.totalXPMultiplier).toBe(1.15);
            expect(result.bonusStrings).toContain('+15% Test Buff');
        });

        it('should ignore expired buffs', () => {
            vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));

            const activeBuffs: Record<string, ActiveBuff> = {
                'test_buff': {
                    value: 0.15,
                    expiresAt: new Date('2024-12-31T12:00:00Z').getTime() // Expired yesterday
                }
            };

            const result = calculateBuffStack(activeBuffs, 'human');
            expect(result.totalXPMultiplier).toBe(1.0);
        });

        it('should ignore buffs for wrong role', () => {
            const activeBuffs: Record<string, ActiveBuff> = {
                'elf_only': { value: 0.20, expiresAt: null }
            };

            const result = calculateBuffStack(activeBuffs, 'human');
            expect(result.totalXPMultiplier).toBe(1.0); // Should not apply to human
        });

        it('should stack multiple buffs appropriately', () => {
            const activeBuffs: Record<string, ActiveBuff> = {
                'test_buff': { value: 0.10, expiresAt: null },
                'elf_only': { value: 0.20, expiresAt: null }
            };

            const result = calculateBuffStack(activeBuffs, 'elf');
            // 1.0 + 0.10 + 0.20 = 1.30
            expect(result.totalXPMultiplier).toBeCloseTo(1.30);
            expect(result.activeBuffs).toHaveLength(2);
        });
    });

    describe('shouldAutoActivateSlingshot', () => {
        it('should return false for non-elves', () => {
            expect(shouldAutoActivateSlingshot('human')).toBe(false);
        });

        it('should return false before start date', () => {
            vi.setSystemTime(new Date('2025-11-21T23:59:59Z')); // Just before
            expect(shouldAutoActivateSlingshot('elf')).toBe(false);
        });

        it('should return true after start date', () => {
            vi.setSystemTime(new Date('2025-11-22T00:00:01Z')); // Just after
            expect(shouldAutoActivateSlingshot('elf')).toBe(true);
        });
    });
});
