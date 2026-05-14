import { useState, useEffect } from 'react'
import { BREAKPOINTS } from '@/config/constants'

/**
 * Custom hook wrapping react-use-window-sizes
 * Provides window dimensions + named breakpoint detection
 */
export function useWindowSize() {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  })

  useEffect(() => {
    let rafId = null

    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      })
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return size
}

/**
 * Named breakpoint hook
 * Returns current breakpoint and boolean flags
 */
export function useBreakpoint() {
  const { width } = useWindowSize()

  return {
    width,
    isMobile: width < BREAKPOINTS.TABLET,
    isTablet: width >= BREAKPOINTS.TABLET && width < BREAKPOINTS.DESKTOP,
    isDesktop: width >= BREAKPOINTS.DESKTOP,
    isWide: width >= BREAKPOINTS.WIDE,
    current:
      width < BREAKPOINTS.TABLET
        ? 'mobile'
        : width < BREAKPOINTS.DESKTOP
          ? 'tablet'
          : width < BREAKPOINTS.WIDE
            ? 'desktop'
            : 'wide',
  }
}
