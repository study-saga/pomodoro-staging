import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChunkLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a chunk loading error
    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.name === 'ChunkLoadError';

    if (isChunkError) {
      return { hasError: true, error };
    }

    // Re-throw non-chunk errors
    throw error;
  }

  attemptReload() {
    const hasReloaded = sessionStorage.getItem('chunk-error-reload');
    if (!hasReloaded) {
      sessionStorage.setItem('chunk-error-reload', 'true');
      console.log('[ChunkLoadError] Auto-reloading...');
      // Use replace to avoid adding to history
      window.location.replace(window.location.href);
    }
  }

  componentDidCatch(error: Error) {
    console.error('[ChunkLoadError]', error);
    this.props.onError?.(error);

    // If we caught a chunk error (determined by getDerivedStateFromError or here), try validity check
    if (this.state.hasError) {
      this.attemptReload();
    }
  }

  componentDidMount() {
    // If error exists on mount (from getDerivedStateFromError), auto-reload once
    if (this.state.hasError) {
      this.attemptReload();
    }
  }

  componentWillUnmount() {
    // Clear reload flag on successful mount (if no error occurred)
    // We only clear if we stayed mounted successfully for a bit, 
    // but effectively if we unmount without error, we can reset.
    if (!this.state.hasError) {
      // delayed clear to ensure it wasn't just a quick flash
      setTimeout(() => {
        sessionStorage.removeItem('chunk-error-reload');
      }, 1000);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-red-400 mb-4">
            ⚠️ Failed to load component
          </div>
          <div className="text-gray-400 text-sm">
            Reloading automatically...
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
