import { useEffect, useRef } from 'react'

export function CustomCursor({ active = true }: { active?: boolean }) {
  const cursorRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const trailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 1. Accessibility & Device Checks
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (isTouch || prefersReducedMotion || !active) {
      document.body.style.cursor = 'auto'
      return
    }

    document.body.style.cursor = 'none'

    // Mouse coordinates (stored in memory, NO React re-renders)
    let mouseX = -100
    let mouseY = -100
    let ringX = -100
    let ringY = -100
    let trailX = -100
    let trailY = -100
    let isVisible = false
    let currentHoverState: 'default' | 'interactive' | 'cta' = 'default'
    let rafId: number | null = null

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY

      if (!isVisible) {
        isVisible = true
        ringX = mouseX
        ringY = mouseY
        trailX = mouseX
        trailY = mouseY
        if (cursorRef.current) cursorRef.current.style.opacity = '1'
        if (ringRef.current) ringRef.current.style.opacity = '1'
        if (trailRef.current) trailRef.current.style.opacity = '0.35'
      }

      // Check hover targets
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-cursor="enter"], .enter-cta-btn, button[data-cta="enter"]')) {
        setHoverMode('cta')
      } else if (
        target?.closest(
          'button, a, input, select, [role="button"], .cursor-pointer, [data-interactive="true"]'
        )
      ) {
        setHoverMode('interactive')
      } else {
        setHoverMode('default')
      }
    }

    const handleMouseLeave = () => {
      isVisible = false
      if (cursorRef.current) cursorRef.current.style.opacity = '0'
      if (ringRef.current) ringRef.current.style.opacity = '0'
      if (trailRef.current) trailRef.current.style.opacity = '0'
    }

    const setHoverMode = (mode: 'default' | 'interactive' | 'cta') => {
      if (currentHoverState === mode) return
      currentHoverState = mode

      if (!cursorRef.current || !ringRef.current) return

      if (mode === 'cta') {
        cursorRef.current.style.transform = `scale(1.22) rotate(45deg)`
        ringRef.current.style.width = '36px'
        ringRef.current.style.height = '36px'
        ringRef.current.style.borderColor = 'rgba(30, 58, 138, 0.75)'
        ringRef.current.style.backgroundColor = 'rgba(37, 99, 235, 0.08)'
      } else if (mode === 'interactive') {
        cursorRef.current.style.transform = `scale(1.12) rotate(15deg)`
        ringRef.current.style.width = '30px'
        ringRef.current.style.height = '30px'
        ringRef.current.style.borderColor = 'rgba(30, 58, 138, 0.55)'
        ringRef.current.style.backgroundColor = 'rgba(37, 99, 235, 0.04)'
      } else {
        cursorRef.current.style.transform = `scale(1.0) rotate(0deg)`
        ringRef.current.style.width = '24px'
        ringRef.current.style.height = '24px'
        ringRef.current.style.borderColor = 'rgba(30, 58, 138, 0.35)'
        ringRef.current.style.backgroundColor = 'transparent'
      }
    }

    // High performance RAF loop using GPU translation
    const loop = () => {
      if (isVisible) {
        // Direct cursor positioning
        if (cursorRef.current) {
          cursorRef.current.style.left = `${mouseX}px`
          cursorRef.current.style.top = `${mouseY}px`
        }

        // Smooth trailing ring lerp
        ringX += (mouseX - ringX) * 0.22
        ringY += (mouseY - ringY) * 0.22
        if (ringRef.current) {
          ringRef.current.style.left = `${ringX}px`
          ringRef.current.style.top = `${ringY}px`
        }

        // Subtle soft micro trail
        trailX += (mouseX - trailX) * 0.12
        trailY += (mouseY - trailY) * 0.12
        if (trailRef.current) {
          trailRef.current.style.left = `${trailX}px`
          trailRef.current.style.top = `${trailY}px`
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseleave', handleMouseLeave)
    rafId = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      if (rafId) cancelAnimationFrame(rafId)
      document.body.style.cursor = 'auto'
    }
  }, [active])

  if (!active) return null

  return (
    <>
      {/* ── Subtle Micro Trail Dot (Vivid blue #2D8CFF) ─── */}
      <div
        ref={trailRef}
        className="pointer-events-none fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 z-[99997] w-1.5 h-1.5 rounded-full bg-[#2D8CFF] opacity-0 transition-opacity duration-300"
        style={{
          boxShadow: '0 0 6px rgba(45, 140, 255, 0.45)',
        }}
      />

      {/* ── Outer Concentric Compass Dial Ring ─────────────────── */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 z-[99998] w-6 h-6 rounded-full border border-[#2D8CFF]/40 opacity-0 transition-[width,height,border-color,background-color] duration-200 ease-out"
        style={{
          boxShadow: '0 0 8px rgba(0, 0, 0, 0.05), inset 0 0 4px rgba(45, 140, 255, 0.12)',
        }}
      />

      {/* ── Refined Coastal Resort Compass Symbol (Center Pointer) ── */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 z-[99999] opacity-0 transition-[transform,opacity] duration-150 ease-out"
      >
        <svg
          className="w-5 h-5 filter"
          style={{
            filter:
              'drop-shadow(0 1px 1.5px rgba(15, 23, 42, 0.35)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.9))',
          }}
          viewBox="0 0 24 24"
        >
          {/* Subtle Outer Cardinal Ticks */}
          <circle
            cx="12"
            cy="12"
            r="8.5"
            fill="none"
            stroke="#2D8CFF"
            strokeWidth="0.65"
            strokeDasharray="1.2 2.2"
            opacity="0.5"
          />

          {/* North Point */}
          <path d="M12 2.5 L12 12 L10.8 10.2 Z" fill="#60A5FA" />
          <path d="M12 2.5 L13.2 10.2 L12 12 Z" fill="#2D8CFF" />

          {/* South Point */}
          <path d="M12 21.5 L12 12 L13.2 13.8 Z" fill="#60A5FA" />
          <path d="M12 21.5 L10.8 13.8 L12 12 Z" fill="#2D8CFF" />

          {/* East Point */}
          <path d="M21.5 12 L12 12 L13.8 10.8 Z" fill="#60A5FA" />
          <path d="M21.5 12 L13.8 13.2 L12 12 Z" fill="#2D8CFF" />

          {/* West Point */}
          <path d="M2.5 12 L12 12 L10.8 13.8 Z" fill="#60A5FA" />
          <path d="M2.5 12 L10.2 10.8 L12 12 Z" fill="#2D8CFF" />

          {/* Center Precision Pivot & Jewel */}
          <circle cx="12" cy="12" r="2.2" fill="#F0F9FF" stroke="#2D8CFF" strokeWidth="0.75" />
          <circle cx="12" cy="12" r="1.1" fill="#2D8CFF" />
        </svg>
      </div>
    </>
  )
}
