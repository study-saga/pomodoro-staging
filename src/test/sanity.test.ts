import { describe, it, expect } from 'vitest';

describe('Sanity Check', () => {
    it('should pass true is true', () => {
        expect(true).toBe(true);
    });

    it('should have access to DOM', () => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        expect(div).toBeInTheDocument();
    });
});
