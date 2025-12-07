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

  componentDidCatch(error: Error) {
    console.error('[ChunkLoadError]', error);
    this.props.onError?.(error);
  }

  componentDidMount() {
    // If error exists on mount, auto-reload once
    if (this.state.hasError) {
      const hasReloaded = sessionStorage.getItem('chunk-error-reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk-error-reload', 'true');
        import.meta.env.DEV && console.log('[ChunkLoadError] Auto-reloading...');
        setTimeout(() => window.location.reload(), 1000);
      }
    }
  }

  componentWillUnmount() {
    // Clear reload flag on successful mount
    if (!this.state.hasError) {
      sessionStorage.removeItem('chunk-error-reload');
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
