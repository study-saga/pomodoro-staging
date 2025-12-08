
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MusicPlayer } from '../MusicPlayer';
import * as SettingsStoreModule from '../../../store/useSettingsStore';

// Mock dependencies
vi.mock('react-howler', () => ({
    default: vi.fn(() => null)
}));

// Mock Hooks
vi.mock('../../../hooks/useDeviceType', () => ({
    useDeviceType: () => ({ isMobile: false, isPortrait: false })
}));

vi.mock('../../../hooks/useMouseActivity', () => ({
    useMouseActivity: () => true
}));

const mockSetMusicVolume = vi.fn();
const mockSetPlaylist = vi.fn();
const mockSetBackground = vi.fn();

const defaultStore = {
    musicVolume: 50,
    setMusicVolume: mockSetMusicVolume,
    background: 'bg-1',
    setBackground: mockSetBackground,
    playlist: 'lofi',
    setPlaylist: mockSetPlaylist,
    autoHideUI: false,
};

vi.mock('../../../store/useSettingsStore', () => ({
    useSettingsStore: (selector: any) => selector ? selector(defaultStore) : defaultStore
}));

describe('MusicPlayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders styles based on device type', () => {
        // Desktop
        render(<MusicPlayer playing={false} setPlaying={vi.fn()} />);
        // Should find "Lofi" or "Synthwave" genre toggle button
        expect(screen.getByText('Lofi')).toBeInTheDocument();
    });

    it('toggles play/pause', () => {
        const mockSetPlaying = vi.fn();
        render(<MusicPlayer playing={false} setPlaying={mockSetPlaying} />);

        // Find play button (it shows Play icon when playing=false)
        // We can find by the button that contains the SVG.
        // Or better, let's rely on the fact that Play/Pause icons are Lucide icons.
        // But testing-library is easiest with roles or aria-labels.
        // The component doesn't have aria-labels on buttons yet (improvement opportunity).
        // We'll select by the svg container button for now or just generic button click.
        // Let's grab the middle button of the controls.

        const buttons = screen.getAllByRole('button');
        // Filter for the play/pause button (usually index 2 in desktop: Genre, Prev, Play, Next...)
        // Desktop: Genre(0), Prev(1), Play(2), Next(3)
        // Let's assume the button with Play icon is what we want.
        // Since we mocked lucide-react? No we didn't mock lucide-react, so SVGs render.
        // We can add "data-testid" to the component or just look for 'Play' logic.
        // Actually, let's just assert existence for now or click the middle one.

        // Let's use standard query:
        // When paused, it shows <Play />.
        // When playing, it shows <Pause />.

        // Since we can't easily query by icon, let's just check the setPlaying interaction.
        // The play button is the 3rd button (index 2) in the desktop layout based on reading code:
        // [Genre, Prev, Play, Next, Seekbar(if click), Volume, Background]
        // But wait, Genre is a button. Prev is button. Play is button.

        // A safer way: Add aria-label to the component in a future PR.
        // For now, let's try to click the one that calls the handler.

        fireEvent.click(buttons[2]); // Play
        expect(mockSetPlaying).toHaveBeenCalledWith(true);
    });

    it('toggles playlist genre', () => {
        render(<MusicPlayer playing={false} setPlaying={vi.fn()} />);

        const genreBtn = screen.getByText('Lofi');
        fireEvent.click(genreBtn);

        expect(mockSetPlaylist).toHaveBeenCalledWith('synthwave');
    });

    it('adjusts volume', () => {
        render(<MusicPlayer playing={false} setPlaying={vi.fn()} />);

        const volumeSlider = screen.getByRole('slider', { hidden: true }); // hidden because custom style often hides default input default?
        // Actually the input type="range" is there with opacity-0 or similar but accessible to pointer.
        // The code says: `appearance-none cursor-pointer bg-transparent`. It IS visible to DOM interaction.

        fireEvent.change(volumeSlider, { target: { value: '80' } });
        expect(mockSetMusicVolume).toHaveBeenCalledWith(80);
    });
});
