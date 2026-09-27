import { useState, useCallback } from 'react'
import { ResortLanding } from './ResortLanding'
import { ResortAuthCard } from './ResortAuthCard'
import { ResortTransition } from './ResortTransition'
import { CustomCursor } from './CustomCursor'
import { type AuthUser } from '@/lib/auth'

interface ResortEntryExperienceProps {
  initialView?: 'landing' | 'login'
  onEntered: () => void
}

export function ResortEntryExperience({
  initialView = 'landing',
  onEntered,
}: ResortEntryExperienceProps) {
  const [view, setView] = useState<'landing' | 'login'>(initialView)
  const [transitionState, setTransitionState] = useState<
    'login' | 'card-exiting' | 'card-exited' | 'dashboard-revealing' | 'dashboard'
  >('login')
  const [exitPhase, setExitPhase] = useState<
    'idle' | 'card-to-center' | 'center-hold' | 'sliding-down' | 'exited'
  >('idle')

  // When user clicks "ENTER RESORT" on the Landing page
  const handleStartAuth = useCallback(() => {
    setView('login')
  }, [])

  // Post-Login Sequential Timeline:
  // PHASE 1 — EXISTING CARD ANIMATION:
  // Step 1: Login card glides to center (0 - 800ms)
  // Step 2: Center hold (800ms - 1150ms)
  // Step 3: Login card slides straight down with existing luminous trail (1150ms - 2100ms)
  //
  // PHASE 2 — CARD COMPLETELY GONE & DASHBOARD WAITS:
  // Step 4: Card AND luminous trail completely leave viewport by 2150ms
  // Viewport is empty of card and trail. Dashboard sits waiting at translateY(100%).
  // Short handoff moment (150ms: 2150ms - 2300ms)
  //
  // PHASE 3 — DASHBOARD REVEAL:
  // Step 5: At 2300ms, start dashboard reveal:
  // - Soft white / cool-blue daylight rises from bottom
  // - Dashboard physically moves UP from below viewport (translateY(100%) -> translateY(0))
  // - Dashboard settles cleanly into resting position
  // - Light dissolves, then onEntered() completes the transition
  const handleAuthSuccess = useCallback((_user: AuthUser) => {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (isReduced) {
      sessionStorage.setItem('resort_entered', 'true')
      onEntered()
      return
    }

    // Step 1: Login card glides to center, covering the left text
    setTransitionState('card-exiting')
    setExitPhase('card-to-center')

    // Step 2: Center hold (settles briefly in the center)
    setTimeout(() => {
      setExitPhase('center-hold')
    }, 800)

    // Step 3: Login card slides straight down off the screen (200vh descent with trail)
    setTimeout(() => {
      setExitPhase('sliding-down')
    }, 1150)

    // Step 4: Card AND luminous trail completely leave the viewport
    setTimeout(() => {
      setExitPhase('exited')
      setTransitionState('card-exited')
    }, 2150)

    // Step 5: After short handoff moment, start dashboard reveal animation
    setTimeout(() => {
      setTransitionState('dashboard-revealing')
    }, 2300)
  }, [onEntered])

  const isTransitioning = transitionState !== 'login'

  return (
    <div
      className={`relative w-full min-h-screen bg-[#FAF9F6] ${
        view === 'landing' && !isTransitioning ? 'overflow-y-auto' : 'overflow-hidden select-none'
      }`}
    >
      {/* Refined Custom Cursor active only during entry experience before exit */}
      <CustomCursor active={exitPhase === 'idle'} />

      {/* ── View 1: Daytime Landing Page ────────────────────────── */}
      {view === 'landing' && !isTransitioning && (
        <ResortLanding onEnter={handleStartAuth} />
      )}

      {/* ── View 2: Daytime Authentication Page ─────────────────── */}
      {(view === 'login' || isTransitioning) && (
        <div className="relative w-full min-h-screen flex items-center justify-center overflow-x-hidden overflow-y-auto">
          {/* Background image during auth with luxury reception interior */}
          <div
            className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-700 ${
              transitionState === 'dashboard-revealing' || transitionState === 'dashboard'
                ? 'opacity-0'
                : 'opacity-100'
            }`}
          >
            <img
              src="/login-reception-bg.png"
              alt="Smart Resort 360 Reception"
              className="w-full h-full object-cover object-center filter brightness-[0.98] contrast-[1.02]"
            />
            {/* Subtle atmospheric gradient preserving reception architecture while enhancing left text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/25 pointer-events-none" />
          </div>

          {/* Main Layout: Left branding + Right glass card */}
          <div className="relative z-10 w-full min-h-screen flex flex-col lg:flex-row items-center justify-between px-6 sm:px-10 lg:pl-[8vw] lg:pr-[8vw] py-10 lg:py-8 max-w-[1600px] mx-auto gap-10 lg:gap-12">
            {/* ── LEFT SIDE: Large statement text (stays in place, disappears BEHIND the moving card) ── */}
            <div
              className={`w-full lg:max-w-[560px] xl:max-w-[620px] flex flex-col items-center lg:items-start text-center lg:text-left space-y-6 z-10 ${
                exitPhase === 'idle' ? 'animate-login-left-slide' : ''
              }`}
              style={{
                clipPath: exitPhase === 'idle' ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
                transition: 'clip-path 750ms cubic-bezier(0.25, 1, 0.5, 1)',
              }}
            >
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/35 backdrop-blur-md border border-white/20 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#2D8CFF] shadow-[0_0_8px_#2D8CFF]" />
                <span className="text-[12px] sm:text-[14px] font-bold tracking-[0.24em] text-[#2D8CFF] uppercase font-sans">
                  Smart Resort 360
                </span>
              </div>

              {/* Main Heading (56–70px, bold, tight line-height, adapted to luxury reception) */}
              <h1 className="text-5xl sm:text-6xl lg:text-[64px] xl:text-[70px] font-extrabold tracking-tight leading-[0.98] lg:leading-[1.0]">
                <span className="text-[#FDFBF7] drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)]">Your stay.</span><br />
                <span className="text-[#2D8CFF] drop-shadow-[0_2px_16px_rgba(45,140,255,0.4)]">Reimagined.</span>
              </h1>

              {/* Supporting Text (18–20px) */}
              <p className="text-[#F1F5F9] text-[18px] lg:text-[20px] font-medium leading-relaxed max-w-lg drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
                Seamless guest experiences, smarter resort operations.
              </p>

              {/* Decorative Luxury Divider & Pillars */}
              <div className="pt-2 flex flex-col items-center lg:items-start space-y-3.5">
                <div className="h-[2.5px] w-20 bg-[#2D8CFF] rounded-full shadow-[0_0_10px_rgba(45,140,255,0.6)]" />
                <div className="text-[12px] sm:text-[13px] font-semibold tracking-[0.16em] text-[#E2E8F0] uppercase drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                  Guest Experience • Operations • Intelligence
                </div>
              </div>
            </div>

            {/* ── RIGHT SIDE: The Main Moving Object (Moves to center, covers left text, slides down completely off screen) ── */}
            <div
              className={`relative w-full lg:w-auto flex justify-center lg:justify-end shrink-0 z-50 ${
                exitPhase === 'idle'
                  ? 'animate-login-right-slide'
                  : exitPhase === 'card-to-center' || exitPhase === 'center-hold'
                  ? 'translate-x-0 lg:-translate-x-[calc(42vw-270px)] translate-y-0 transition-transform duration-800 ease-[cubic-bezier(0.25,1,0.5,1)]'
                  : exitPhase === 'sliding-down'
                  ? 'translate-x-0 lg:-translate-x-[calc(42vw-270px)] translate-y-[200vh] transition-transform duration-[950ms] ease-[cubic-bezier(0.32,0,0.67,0)]'
                  : 'translate-x-0 lg:-translate-x-[calc(42vw-270px)] translate-y-[200vh] opacity-0 pointer-events-none'
              }`}
            >
              {/* Luminous upward optical trail attached to the top of the downward-moving card */}
              {exitPhase === 'sliding-down' && (
                <div
                  className="animate-glass-trail absolute bottom-[96%] left-1/2 -translate-x-1/2 w-[92%] h-[480px] pointer-events-none z-0"
                  aria-hidden="true"
                >
                  {/* Diffuse ambient blue-white shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-[#2D8CFF]/25 to-transparent blur-2xl" />

                  {/* Core refractive glass light beam */}
                  <div className="absolute inset-x-6 inset-y-0 bg-gradient-to-t from-white/75 via-[#2D8CFF]/45 to-transparent blur-md" />

                  {/* Twin specular edge streaks reflecting off glass boundaries */}
                  <div className="absolute left-2 inset-y-0 w-[2.5px] bg-gradient-to-t from-white/90 via-[#2D8CFF]/60 to-transparent blur-[1.5px]" />
                  <div className="absolute right-2 inset-y-0 w-[2.5px] bg-gradient-to-t from-white/90 via-[#2D8CFF]/60 to-transparent blur-[1.5px]" />

                  {/* Concentrated bottom light flare at the glass rim */}
                  <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-white/80 via-[#2D8CFF]/50 to-transparent blur-sm" />
                </div>
              )}

              <ResortAuthCard
                onSuccess={handleAuthSuccess}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── View 3: Soft Daylight & Dashboard Entrance Transition ───── */}
      <ResortTransition
        active={transitionState === 'dashboard-revealing'}
        onComplete={() => {
          setTransitionState('dashboard')
          onEntered()
        }}
      />
    </div>
  )
}

