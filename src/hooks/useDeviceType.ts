import { useState, useEffect } from 'react'

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

  useEffect(() => {
    const checkDevice = () => {
      // Show mobile version below specified breakpoint
      const mobile = window.innerWidth < breakpoint
      // Determine orientation based on aspect ratio
      const portrait = window.innerHeight > window.innerWidth
      setIsMobile(mobile)
      setIsPortrait(portrait)
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

  return { isMobile, isPortrait }
}
