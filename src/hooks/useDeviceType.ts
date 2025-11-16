import { useState, useEffect } from 'react'

export function useDeviceType() {
  const [isMobile, setIsMobile] = useState(() => {
    // Initial detection - use 768px breakpoint for compact Level UI
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  })

  useEffect(() => {
    const checkDevice = () => {
      // Show compact version below 768px
      const mobile = window.innerWidth < 768
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
  }, [])

  return { isMobile }
}
