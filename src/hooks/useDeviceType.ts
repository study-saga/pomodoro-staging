import { useState, useEffect } from 'react'

export function useDeviceType(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    // Initial detection - use specified breakpoint
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    const checkDevice = () => {
      // Show mobile version below specified breakpoint
      const mobile = window.innerWidth < breakpoint
      setIsMobile(mobile)
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

  return { isMobile }
}
