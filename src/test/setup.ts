import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock IntersectionObserver
class IntersectionObserverMock {
    readonly root: Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
    constructor() { }
}
Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: IntersectionObserverMock
});

// Mock ResizeObserver
class ResizeObserverMock {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor() { }
}
Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverMock
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock HTMLAudioElement (for howler/use-sound/Audio)
window.HTMLMediaElement.prototype.load = vi.fn();
window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = vi.fn();

// Mock localStorage
const localStorageMock = (function () {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value.toString();
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        key: vi.fn((index: number) => Object.keys(store)[index] || null),
        get length() {
            return Object.keys(store).length;
        }
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});
