import { useEffect, useRef } from 'react'
import gsap from 'gsap'

interface ResortTransitionProps {
  active: boolean
  userRole?: string
  userName?: string
  onComplete: () => void
}

/**
 * ResortTransition: Soft Daylight & Dashboard Entrance
 * 
 * Sequence:
 * 1. Soft white / cool-blue light begins rising from the bottom of the viewport.
 * 2. At the same time, the dashboard begins moving UP from below the viewport (translateY(100%) -> translateY(0)).
 * 3. The dashboard feels like it is being brought upward by the light.
 * 4. The dashboard settles into its normal position with smooth cinematic easing (power3.out).
 * 5. Light softly dissolves into normal daylight.
 */
export function ResortTransition({
  active,
  onComplete,
}: ResortTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lightRef = useRef<HTMLDivElement>(null)
  const ambientRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    if (!active) return

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // If reduced motion is requested, instantly reveal dashboard cleanly
    if (isReduced) {
      const dashboardEl = document.getElementById('dashboard-reveal-container')
      if (dashboardEl) {
        dashboardEl.style.opacity = '1'
        dashboardEl.style.transform = 'none'
        dashboardEl.style.visibility = 'visible'
        dashboardEl.style.filter = 'none'
      }
      onComplete()
      return
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          const dashboardEl = document.getElementById('dashboard-reveal-container')
          if (dashboardEl) {
            dashboardEl.style.opacity = '1'
            dashboardEl.style.transform = 'none'
            dashboardEl.style.visibility = 'visible'
            dashboardEl.style.filter = 'none'
          }
          onComplete()
        },
      })

      timelineRef.current = tl

      const dashboardEl = document.getElementById('dashboard-reveal-container')

      // Initial state:
      gsap.set(containerRef.current, { opacity: 1, display: 'block' })
      gsap.set(lightRef.current, { y: '45%', opacity: 0, scaleY: 0.75 })
      gsap.set(ambientRef.current, { opacity: 0 })

      // Dashboard starts completely below viewport and made visible for upward glide
      if (dashboardEl) {
        gsap.set(dashboardEl, {
          y: '100%',
          opacity: 1,
          visibility: 'visible',
          filter: 'none',
        })
      }

      // ── START DASHBOARD REVEAL TIMELINE ─────────────────────────
      tl.addLabel('lightRise')

      // 1. Subtle ambient cool blue-white wash (low opacity, barely luminous)
      tl.to(
        ambientRef.current,
        {
          opacity: 0.35,
          duration: 0.75,
          ease: 'power2.out',
        },
        'lightRise'
      )

      // Soft daylight bloom rises and expands gently from bottom
      tl.to(
        lightRef.current,
        {
          y: '0%',
          opacity: 0.75,
          scaleY: 1.15,
          duration: 0.95,
          ease: 'power2.out',
        },
        'lightRise'
      )

      // 2. Simultaneous: Dashboard physically moves UP from below viewport (100% -> 0%)
      if (dashboardEl) {
        tl.to(
          dashboardEl,
          {
            y: '0%',
            duration: 1.25,
            ease: 'power3.out',
          },
          'lightRise+=0.05'
        )
      }

      // 3. As the dashboard reaches its resting position and settles, light softly dissolves
      tl.to(
        lightRef.current,
        {
          opacity: 0,
          duration: 0.6,
          ease: 'power2.inOut',
        },
        'lightRise+=0.95'
      )

      tl.to(
        ambientRef.current,
        {
          opacity: 0,
          duration: 0.5,
          ease: 'power2.inOut',
        },
        'lightRise+=1.05'
      )

      tl.to(
        containerRef.current,
        {
          opacity: 0,
          duration: 0.3,
          ease: 'power2.inOut',
        },
        'lightRise+=1.2'
      )
    })

    return () => {
      ctx.revert()
    }
  }, [active, onComplete])

  if (!active) return null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      aria-hidden="true"
    >
      {/* Subtle ambient cool blue-white wash */}
      <div
        ref={ambientRef}
        className="absolute inset-0 bg-gradient-to-t from-[#2D8CFF]/10 via-white/12 to-transparent pointer-events-none"
      />

      {/* Soft daylight bloom rising from the lower portion of the screen */}
      <div
        ref={lightRef}
        className="absolute -bottom-1/4 -inset-x-1/4 h-[85vh] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 130% 70% at 50% 100%, rgba(255, 255, 255, 0.85) 0%, rgba(224, 242, 254, 0.45) 30%, rgba(186, 230, 253, 0.15) 60%, transparent 85%)',
        }}
      />
    </div>
  )
}

