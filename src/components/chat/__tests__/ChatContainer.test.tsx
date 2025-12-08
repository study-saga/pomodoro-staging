import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatContainer } from '../ChatContainer';
import * as ChatContextModule from '../../../contexts/ChatContext';
import * as AuthContextModule from '../../../contexts/AuthContext';
import * as SettingsStoreModule from '../../../store/useSettingsStore';

// Mock dependnecies
vi.mock('../../../contexts/ChatContext', () => ({
    useChat: vi.fn(),
    ChatProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: vi.fn(),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock Settings Store
const mockUseSettingsStore = vi.fn();
vi.mock('../../../store/useSettingsStore', () => ({
    useSettingsStore: (selector: any) => mockUseSettingsStore(selector)
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
        button: ({ children, className, onClick, ...props }: any) => <button className={className} onClick={onClick} {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Mock components that might cause issues
vi.mock('../MessageInput', () => ({
    MessageInput: ({ onSendMessage, placeholder }: any) => (
        <input
            data-testid="message-input"
            placeholder={placeholder}
            onKeyDown={(e) => {
                if (e.key === 'Enter') onSendMessage(e.currentTarget.value);
            }}
        />
    )
}));

describe('ChatContainer', () => {
    const mockUser = {
        id: 'test-user-id',
        username: 'TestUser',
        avatar: 'avatar.png',
        discord_id: '123'
    };

    const mockChatContext = {
        onlineUsers: [],
        setChatOpen: vi.fn(),
        isChatEnabled: true,
        sendGlobalMessage: vi.fn(),
        isGlobalConnected: true,
        isBanned: false,
        banReason: null,
        banExpiresAt: null,
        banUser: vi.fn(),
        globalMessages: []
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mocks
        (AuthContextModule.useAuth as any).mockReturnValue({ appUser: mockUser });
        (ChatContextModule.useChat as any).mockReturnValue(mockChatContext);

        // Mock settings store selector
        mockUseSettingsStore.mockImplementation((selector: any) => {
            // Mock state
            const state = { autoHideUI: false };
            return selector(state);
        });
    });

    it('renders nothing when user is not authenticated', () => {
        (AuthContextModule.useAuth as any).mockReturnValue({ appUser: null });
        const { container } = render(<ChatContainer />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders chat button when authenticated and collapsed', () => {
        render(<ChatContainer />);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('expands chat when button is clicked', async () => {
        // Need to re-render to ensure state is fresh
        render(<ChatContainer />);

        const button = screen.getByRole('button');
        fireEvent.click(button);

        // Check for something that definitely appears when expanded
        // "General" is the text in the local tab button
        await waitFor(() => {
            expect(screen.getByText('General')).toBeInTheDocument();
        });
    });

    it('calls sendGlobalMessage when message is sent', async () => {
        const user = {
            username: 'TestUser',
            id: 'test-user-id',
            avatar: 'avatar.png',
            discord_id: '123'
        };
        (AuthContextModule.useAuth as any).mockReturnValue({ appUser: user });

        render(<ChatContainer />);
        fireEvent.click(screen.getByRole('button'));

        const input = screen.getByTestId('message-input');
        fireEvent.keyDown(input, { key: 'Enter', target: { value: 'Hello World' } });

        expect(mockChatContext.sendGlobalMessage).toHaveBeenCalledWith('Hello World', expect.objectContaining({
            username: 'TestUser'
        }));
    });

    it('shows maintenance mode when chat is disabled', () => {
        // Override the hook for this specific test
        (ChatContextModule.useChat as any).mockReturnValue({
            ...mockChatContext,
            isChatEnabled: false
        });

        render(<ChatContainer />);
        // Just check the button title first, as it changes when disabled
        const button = screen.getByTitle('Chat disabled');
        expect(button).toBeInTheDocument();

        // Now click and check overlay
        fireEvent.click(button);
        expect(screen.getByText('Chat Disabled')).toBeInTheDocument();
    });

    it('shows banned UI when user is banned', async () => {
        (ChatContextModule.useChat as any).mockReturnValue({
            ...mockChatContext,
            isBanned: true,
            banReason: 'Spamming'
        });

        render(<ChatContainer />);
        // Button should indicate ban
        expect(screen.getByTitle('You are banned')).toBeInTheDocument();

        // Expand
        fireEvent.click(screen.getByRole('button'));

        // Should see ban message
        expect(screen.getByText('Account Banned')).toBeInTheDocument();
        expect(screen.getByText('Spamming')).toBeInTheDocument();
    });
});
