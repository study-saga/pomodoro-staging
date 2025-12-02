/**
 * Lightweight loading spinner for Suspense fallback
 * Used during lazy component loading (code splitting)
 */

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
    </div>
  );
}
