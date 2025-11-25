import { useState, useEffect } from 'react'

/**
 * Detects viewport characteristics and exposes flags for mobile, portrait, and compact layouts.
 *
 * @param breakpoint - Width in pixels below which the viewport is considered mobile (default 768)
 * @returns An object with three booleans:
 * - `isMobile`: `true` if the viewport width is less than `breakpoint`, `false` otherwise.
 * - `isPortrait`: `true` if the viewport height is greater than its width, `false` otherwise.
 * - `isCompact`: `true` if the viewport width is less than 1024 pixels or the height is less than 700 pixels, `false` otherwise.
 */
export function useDeviceType(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    // Initial detection - use specified breakpoint
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  const [isPortrait, setIsPortrait] = useState(() => {
    // Initial detection - check if height > width (portrait orientation)
    if (typeof window === 'undefined') return false
    return window.innerHeight > window.innerWidth
  })

  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 1024 || window.innerHeight < 700
  })

  useEffect(() => {
    const checkDevice = () => {
      // Show mobile version below specified breakpoint
      const mobile = window.innerWidth < breakpoint
      // Determine orientation based on aspect ratio
      const portrait = window.innerHeight > window.innerWidth
      // Compact mode for small laptops or Discord activity windows
      const compact = window.innerWidth < 1024 || window.innerHeight < 700

      setIsMobile(mobile)
      setIsPortrait(portrait)
      setIsCompact(compact)
    }

    // Debounce resize events for performance
    let timeoutId: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(checkDevice, 300)
    }

    // Listen for both resize and orientation change
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', checkDevice)

    // Initial check
    checkDevice()

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', checkDevice)
    }
  }, [breakpoint])

  return { isMobile, isPortrait, isCompact }
}