import { useState, useEffect } from 'react'

export interface EnhancedDeviceType {
  /** True if real mobile device (phone/tablet) via user agent */
  isRealMobile: boolean
  /** True if Discord Activity (has frame_id or instance_id params) */
  isDiscordActivity: boolean
  /** True if window width < breakpoint (default 768px) */
  isMobile: boolean
  /** True if portrait orientation */
  isPortrait: boolean
  /** True if compact viewport (< 1024px width or < 700px height) */
  isCompact: boolean
  /** Current viewport width */
  viewportWidth: number
  /** Current viewport height */
  viewportHeight: number
}

/**
 * Enhanced device detection combining user agent, viewport, and Discord Activity
 *
 * Detects:
 * - Real mobile devices (iOS, Android) via user agent
 * - Discord Activity context (frame_id/instance_id params)
 * - Viewport dimensions (width, height, orientation)
 * - Compact mode (small Discord Activity windows)
 *
 * @param breakpoint - Mobile breakpoint in pixels (default: 768)
 * @returns Enhanced device information
 */
export function useEnhancedDeviceType(breakpoint: number = 768): EnhancedDeviceType {
  // Detect real mobile device via user agent (runs once)
  const [isRealMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false

    const ua = window.navigator.userAgent.toLowerCase()

    // iOS detection
    const isIOS = /iphone|ipad|ipod/.test(ua)

    // Android detection
    const isAndroid = /android/.test(ua)

    // Tablet detection (iPadOS 13+ reports as Mac)
    const isTablet = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/.test(ua) ||
      (navigator.maxTouchPoints > 2 && /mac/.test(ua))

    return Boolean(isIOS || isAndroid || isTablet)
  })

  // Detect Discord Activity (runs once)
  const [isDiscordActivity] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return params.has('frame_id') || params.has('instance_id')
  })

  // Viewport state (reactive)
  const [viewport, setViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1920,
        height: 1080,
        isMobile: false,
        isPortrait: false,
        isCompact: false
      }
    }

    const width = window.innerWidth
    const height = window.innerHeight

    return {
      width,
      height,
      isMobile: width < breakpoint,
      isPortrait: height > width,
      isCompact: width < 1024 || height < 700
    }
  })

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setViewport({
        width,
        height,
        isMobile: width < breakpoint,
        isPortrait: height > width,
        isCompact: width < 1024 || height < 700
      })
    }

    // Debounced resize handler (300ms)
    let timeoutId: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateViewport, 300)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', updateViewport)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', updateViewport)
    }
  }, [breakpoint])

  return {
    isRealMobile,
    isDiscordActivity,
    isMobile: viewport.isMobile,
    isPortrait: viewport.isPortrait,
    isCompact: viewport.isCompact,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height
  }
}
