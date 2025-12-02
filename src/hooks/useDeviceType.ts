import { useState, useEffect } from 'react'

export function useDeviceType(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    // Initial detection - use specified breakpoint
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  const [isTablet, setIsTablet] = useState(() => {
    // Initial detection - tablet range (768-1024px)
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 768 && window.innerWidth < 1024
  })

  const [isPortrait, setIsPortrait] = useState(() => {
    // Initial detection - check if height > width (portrait orientation)
    if (typeof window === 'undefined') return false
    return window.innerHeight > window.innerWidth
  })

  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined') return false
    // Fix: Exclude tablet range from compact mode
    return window.innerWidth < 768 || (window.innerWidth >= 1024 && window.innerHeight < 700)
  })

  useEffect(() => {
    const checkDevice = () => {
      // Show mobile version below specified breakpoint
      const mobile = window.innerWidth < breakpoint
      // Tablet range (768-1024px)
      const tablet = window.innerWidth >= 768 && window.innerWidth < 1024
      // Determine orientation based on aspect ratio
      const portrait = window.innerHeight > window.innerWidth
      // Compact mode for small laptops or Discord activity windows (exclude tablet range)
      const compact = window.innerWidth < 768 || (window.innerWidth >= 1024 && window.innerHeight < 700)

      setIsMobile(mobile)
      setIsTablet(tablet)
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

  return { isMobile, isTablet, isPortrait, isCompact }
}
