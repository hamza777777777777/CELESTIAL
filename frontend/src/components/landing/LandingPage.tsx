import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Menu, X, ArrowRight } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

type AppState =
  | 'LANDING'
  | 'TRANSITION_START'
  | 'TRANSITION_DARKENING'
  | 'TRANSITION_VIDEO_REVEAL'
  | 'VIDEO'
  | 'VIDEO_ENDING'
  | 'VIDEO_DARKENING'

const HERO_BG = '/images/hero-resort.jpg?v=3'
const LOGIN_BG = 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80'
const ABOUT_BG = 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1920&q=75'
const FOR_WHOM_BG = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1920&q=75'
const CTA_BG = 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1920&q=75'

// Color Tokens (Tropical Aquatic)
const C = {
  white: '#FFFFFF',
  surfaceLight: '#F8FEFF',
  turquoise: '#00B8C8',
  aqua: '#12D8D0',
  lagoon: '#08A9E6',
  sky: '#38BDF8',
  teal: '#075E73',
  tealDark: '#034B5A',
  coral: '#FF6B5F',
  orange: '#FF9F43',
  divider: '#D7F3F6',
}

interface LandingPageProps {
  onEnter?: () => void
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const [state, setState] = useState<AppState>('LANDING')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [enterClicked, setEnterClicked] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const stateRef = useRef<AppState>('LANDING')
  const navigate = useNavigate()

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const proceedToLogin = useCallback(() => {
    if (onEnter) {
      onEnter()
    } else {
      navigate({ to: '/', search: { view: 'login' } })
    }
  }, [onEnter, navigate])

  // Original video playback & completion lifecycle
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onLoadedData = () => {
      video.playbackRate = 1.2
      setVideoReady(true)
    }

    const onEnded = () => {
      setState('VIDEO_ENDING')
      setTimeout(() => {
        setState('VIDEO_DARKENING')
        setTimeout(() => {
          proceedToLogin()
        }, 800)
      }, 600)
    }

    const onPause = () => {
      if (stateRef.current === 'VIDEO' && !video.ended) {
        video.play().catch(() => {})
      }
    }

    video.addEventListener('loadeddata', onLoadedData)
    video.addEventListener('ended', onEnded)
    video.addEventListener('pause', onPause)

    if (video.readyState >= 2) {
      video.playbackRate = 1.2
      setVideoReady(true)
    }

    return () => {
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('pause', onPause)
    }
  }, [proceedToLogin])

  // Original multi-phase transition sequence triggered on CTA click
  const handleEnterResort = useCallback(() => {
    if (state !== 'LANDING' || enterClicked) return
    setEnterClicked(true)
    setMobileMenuOpen(false)

    setTimeout(() => {
      setState('TRANSITION_START')
      setTimeout(() => {
        setState('TRANSITION_DARKENING')
        setTimeout(() => {
          setState('TRANSITION_VIDEO_REVEAL')
          setTimeout(() => {
            setState('VIDEO')
            const video = videoRef.current
            if (video) {
              video.currentTime = 0
              video.playbackRate = 1.2
              video.play().catch(() => {
                // Autoplay fallback: if browser blocks video, proceed cleanly
                proceedToLogin()
              })
            }
          }, 500)
        }, 1000)
      }, 800)
    }, 300)
  }, [state, enterClicked, proceedToLogin])

  const handleSkip = useCallback(() => {
    setState('VIDEO_DARKENING')
    setTimeout(() => {
      proceedToLogin()
    }, 400)
  }, [proceedToLogin])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenuOpen(false)
  }, [])

  const isTransitioning =
    state === 'TRANSITION_START' ||
    state === 'TRANSITION_DARKENING' ||
    state === 'TRANSITION_VIDEO_REVEAL'

  const videoVisible =
    state === 'TRANSITION_VIDEO_REVEAL' ||
    state === 'VIDEO' ||
    state === 'VIDEO_ENDING' ||
    state === 'VIDEO_DARKENING'

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: C.white }}>
      {/* ── Cinematic Video Element ──────────────────────────────── */}
      <video
        ref={videoRef}
        className="fixed inset-0 w-full h-full object-cover"
        style={{
          zIndex: videoVisible ? 50 : 0,
          opacity: videoVisible ? 1 : 0,
          transition: 'opacity 700ms ease',
          pointerEvents: videoVisible ? 'auto' : 'none',
        }}
        muted
        playsInline
        preload="auto"
      >
        <source src="/landing.mp4" type="video/mp4" />
      </video>

      {/* ── Skip Intro Button during Cinematic Sequence ───────────── */}
      {(state === 'VIDEO' || state === 'VIDEO_ENDING') && (
        <button
          onClick={handleSkip}
          className="fixed bottom-8 right-8 z-[70] px-5 py-2.5 rounded-full text-white/90 hover:text-white bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/20 transition-all text-xs tracking-widest uppercase flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105"
        >
          Skip Intro <ArrowRight size={14} />
        </button>
      )}

      {/* ── Multi-Phase Transition Overlays (From Original Code) ──── */}
      {isTransitioning && (
        <>
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              zIndex: 10,
              background: `linear-gradient(to bottom, ${C.white}, ${C.surfaceLight})`,
              opacity:
                state === 'TRANSITION_START'
                  ? 1
                  : state === 'TRANSITION_DARKENING'
                    ? 0.65
                    : 0.2,
              transform:
                state === 'TRANSITION_START'
                  ? 'scale(1)'
                  : state === 'TRANSITION_DARKENING'
                    ? 'scale(1.015)'
                    : 'scale(1.03)',
              filter:
                state === 'TRANSITION_START' ? 'blur(0px)' : 'blur(1.5px)',
              transition:
                'opacity 1000ms ease-in-out, transform 1000ms ease-in-out, filter 1000ms ease-in-out',
            }}
          />
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              zIndex: 40,
              background:
                'radial-gradient(ellipse at center, rgba(7,94,115,0.3) 0%, rgba(7,94,115,0.95) 100%)',
              opacity:
                state === 'TRANSITION_START'
                  ? 0
                  : state === 'TRANSITION_DARKENING'
                    ? 0.8
                    : 0.95,
              transition: 'opacity 1200ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </>
      )}

      {/* ── Darkening Overlay at Transition Completion to Login ───── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 65,
          background: C.tealDark,
          opacity: state === 'VIDEO_DARKENING' ? 0.98 : 0,
          transition: 'opacity 800ms cubic-bezier(0.4, 0, 0.6, 1)',
        }}
      />

      {/* ── Landing Page Content ─────────────────────────────────── */}
      {(state === 'LANDING' || isTransitioning) && (
        <LandingContent
          enterClicked={enterClicked}
          videoReady={videoReady}
          mobileMenuOpen={mobileMenuOpen}
          onEnterResort={handleEnterResort}
          onScrollTo={scrollTo}
          onMobileMenu={() => setMobileMenuOpen((v) => !v)}
        />
      )}
    </div>
  )
}

interface LandingContentProps {
  enterClicked: boolean
  videoReady: boolean
  mobileMenuOpen: boolean
  onEnterResort: () => void
  onScrollTo: (id: string) => void
  onMobileMenu: () => void
}

function LandingContent({
  enterClicked,
  mobileMenuOpen,
  onEnterResort,
  onScrollTo,
  onMobileMenu,
}: LandingContentProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-img', {
        scale: 1.03,
        duration: 2.5,
        ease: 'power2.out',
      })
      gsap.from('.hero-overlay', {
        opacity: 0,
        duration: 2,
        ease: 'power2.out',
      })
      gsap.from('.hero-reveal', {
        y: 30,
        opacity: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: 'power3.out',
        delay: 0.2,
      })

      gsap.utils.toArray('.img-reveal-wrapper').forEach((wrapper: any) => {
        const img = wrapper.querySelector('.img-reveal')
        if (img) {
          gsap.fromTo(
            img,
            { scale: 1.05, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: 1.4,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: wrapper,
                start: 'top 85%',
              },
            }
          )
        }
      })

      gsap.utils.toArray('.text-reveal').forEach((elem: any) => {
        gsap.from(elem, {
          y: 30,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: elem,
            start: 'top 85%',
          },
        })
      })

      gsap.utils.toArray('.stagger-list').forEach((list: any) => {
        gsap.from(list.children, {
          y: 20,
          opacity: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: list,
            start: 'top 85%',
          },
        })
      })

      const storyCount = 6

      gsap.set('.story-panel-0', { opacity: 1, pointerEvents: 'auto' })
      gsap.set('.story-img-0', { scale: 1, clipPath: 'inset(0% 0% 0% 0%)' })
      gsap.set('.story-title-0, .story-desc-0', { y: 0, opacity: 1 })

      for (let i = 1; i < storyCount; i++) {
        gsap.set(`.story-panel-${i}`, { opacity: 0, pointerEvents: 'none' })
        gsap.set(`.story-img-${i}`, { scale: 1.05, clipPath: 'inset(100% 0% 0% 0%)' })
        gsap.set(`.story-title-${i}, .story-desc-${i}`, { y: 30, opacity: 0 })
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#features',
          start: 'top top',
          end: 'bottom bottom',
          pin: '.story-viewport',
          scrub: 1,
          onUpdate: (self) => {
            const progress = self.progress
            const activeIndex = Math.min(Math.floor(progress * storyCount), storyCount - 1)

            document.querySelectorAll('.story-nav-item').forEach((item, index) => {
              if (index === activeIndex) {
                item.classList.add('active', 'opacity-100')
                item.classList.remove('opacity-40')
                item.querySelector('.nav-dot')?.classList.remove('opacity-0')
              } else {
                item.classList.remove('active', 'opacity-100')
                item.classList.add('opacity-40')
                item.querySelector('.nav-dot')?.classList.add('opacity-0')
              }
            })
          },
        },
      })

      for (let i = 0; i < storyCount - 1; i++) {
        const current = i
        const next = i + 1

        tl.addLabel(`settle-${current}`, `+=${0.3}`)

        tl.to(
          `.story-panel-${current}`,
          {
            opacity: 0,
            duration: 0.5,
            ease: 'power2.inOut',
            pointerEvents: 'none',
          },
          `transition-${current}`
        )

        tl.to(
          `.story-title-${current}, .story-desc-${current}`,
          {
            y: -20,
            opacity: 0,
            duration: 0.5,
            stagger: 0.1,
            ease: 'power2.inOut',
          },
          `transition-${current}`
        )

        tl.to(
          `.story-panel-${next}`,
          {
            opacity: 1,
            duration: 0.5,
            ease: 'power2.inOut',
            pointerEvents: 'auto',
          },
          `transition-${current}`
        )

        tl.to(
          `.story-img-${next}`,
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            scale: 1,
            duration: 0.8,
            ease: 'power2.out',
          },
          `transition-${current}`
        )

        tl.to(
          `.story-title-${next}, .story-desc-${next}`,
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: 'power2.out',
          },
          `transition-${current}+=0.2`
        )
      }

      tl.addLabel('settle-final', `+=${0.4}`)
    })

    return () => ctx.revert()
  }, [])

  return (
    <div className="relative z-10 w-full overflow-x-hidden" style={{ backgroundColor: C.white }}>
      {/* HEADER / NAVIGATION */}
      <nav
        className="fixed top-0 left-0 right-0 z-40 transition-all duration-500 ease-in-out pointer-events-none"
        style={{
          background: 'transparent',
          paddingTop: scrolled ? '0.5rem' : '1.5rem',
          paddingBottom: scrolled ? '0.5rem' : '0.5rem',
        }}
      >
        <div className="container mx-auto px-6 md:px-12 h-[80px] flex items-center justify-between max-w-[1550px] pointer-events-auto">
          <button
            onClick={() => onScrollTo('home')}
            className="flex items-baseline group"
            aria-label="Smart Hotel — scroll to top"
          >
            <span
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '1.4rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: scrolled ? C.teal : C.white,
                transition: 'color 500ms',
                textShadow: scrolled ? 'none' : '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              SMART HOTEL
            </span>
          </button>

          <div className="hidden md:flex items-center gap-4">
            {(['about', 'experience', 'features', 'for-whom'] as const).map((id) => (
              <NavLink
                key={id}
                label={id === 'for-whom' ? 'For Guests' : id.charAt(0).toUpperCase() + id.slice(1)}
                onClick={() => onScrollTo(id)}
                scrolled={scrolled}
              />
            ))}
          </div>

          <div className="hidden md:flex">
            <EnterButton
              onClick={onEnterResort}
              disabled={enterClicked}
              small
              scrolled={scrolled}
            />
          </div>

          <button
            onClick={onMobileMenu}
            className="md:hidden p-2"
            style={{ color: scrolled ? C.teal : C.white, transition: 'color 500ms' }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* MOBILE MENU DROPDOWN */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 md:hidden px-8"
          style={{
            backgroundColor: 'rgba(7, 94, 115, 0.98)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {(['about', 'experience', 'features', 'for-whom'] as const).map((id) => (
            <button
              key={id}
              onClick={() => onScrollTo(id)}
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '1.8rem',
                color: C.white,
              }}
            >
              {id === 'for-whom' ? 'For Guests' : id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
          <div className="mt-6 w-full max-w-xs">
            <EnterButton onClick={onEnterResort} disabled={enterClicked} fullWidth />
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <section
        id="home"
        className="relative h-[100svh] min-h-[700px] flex items-center justify-center overflow-hidden"
      >
        {/* Background Image */}
        <div className="absolute inset-0 z-0 bg-[#075E73]">
          <img
            src={HERO_BG}
            className="hero-img w-full h-full object-cover object-center"
            alt="Smart Hotel Resort architecture and pool"
          />
        </div>

        {/* Localized Contrast Zones */}
        <div
          className="absolute top-0 left-0 w-full h-[150px] pointer-events-none z-10"
          style={{ background: 'linear-gradient(to bottom, rgba(4, 45, 55, 0.5) 0%, transparent 100%)' }}
        />
        <div
          className="absolute left-0 bottom-0 w-full md:w-[70%] h-[75%] pointer-events-none z-10"
          style={{
            background:
              'radial-gradient(ellipse at 15% 85%, rgba(4, 45, 55, 0.65) 0%, rgba(4, 45, 55, 0.25) 45%, transparent 70%)',
          }}
        />
        <div
          className="absolute right-0 bottom-0 w-full md:w-[45%] h-[60%] pointer-events-none z-10"
          style={{
            background:
              'radial-gradient(ellipse at 85% 80%, rgba(4, 45, 55, 0.65) 0%, rgba(4, 45, 55, 0.2) 50%, transparent 75%)',
          }}
        />

        {/* Content Container */}
        <div className="relative z-20 w-full max-w-[1550px] mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-start md:items-end pb-[12vh] pt-32 h-full gap-10">
          <div className="w-full md:w-[55%] mt-auto pr-0 md:pr-8">
            <p
              className="hero-reveal mb-6"
              style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: C.aqua,
                textShadow: '0 1px 8px rgba(0,30,40,0.5)',
              }}
            >
              Connected Hospitality
            </p>
            <h1
              className="hero-reveal mb-4"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 'clamp(3rem, 6.5vw, 6.2rem)',
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: C.white,
                textShadow: '0 2px 16px rgba(0,30,40,0.3)',
                overflowWrap: 'break-word',
                wordBreak: 'keep-all',
              }}
            >
              Stay Smarter.<br />
              <em style={{ fontStyle: 'italic', color: C.sky }}>Live Better.</em>
            </h1>
          </div>
          <div className="w-full md:w-[40%] max-w-md md:pb-6 flex flex-col">
            <p
              className="hero-reveal mb-10"
              style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 'clamp(1.05rem, 1.3vw, 1.25rem)',
                fontWeight: 400,
                lineHeight: 1.6,
                color: C.white,
                textShadow: '0 1px 10px rgba(0,30,40,0.5)',
              }}
            >
              A connected hospitality platform designed to make every part of your stay simpler, smarter, and more personal.
            </p>
            <div className="hero-reveal flex gap-5">
              <EnterButton onClick={onEnterResort} disabled={enterClicked} />
            </div>
          </div>
        </div>
      </section>

      {/* METRICS / PROOF SECTION */}
      <section className="px-6 md:px-12 py-32 max-w-[1550px] mx-auto" style={{ backgroundColor: C.white }}>
        <div
          className="border-t border-b py-16 stagger-list grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12"
          style={{ borderColor: C.divider }}
        >
          {[
            { n: '01', t: 'Smart Stay', d: 'Manage your entire stay digitally from one connected, intuitive platform.' },
            { n: '02', t: 'Connected Services', d: 'Access hotel services and requests without unnecessary friction or delay.' },
            { n: '03', t: 'Personalised', d: 'Every guest receives tailored experiences shaped around individual preferences.' },
            { n: '04', t: 'Operations', d: 'Seamlessly connect guest services with efficient, responsive hotel management.' },
          ].map((p) => (
            <div key={p.n} className="flex flex-col">
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '3.2rem', color: C.teal, lineHeight: 1 }}>
                {p.n}
              </span>
              <span
                className="mt-5 mb-3"
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: C.turquoise,
                }}
              >
                {p.t}
              </span>
              <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: '1rem', color: C.tealDark, lineHeight: 1.6 }}>
                {p.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* IMAGE / SOCIAL PROOF (Deep Aquatic Section) */}
      <section id="about" className="px-6 md:px-12 py-32" style={{ backgroundColor: C.tealDark }}>
        <div className="max-w-[1550px] mx-auto text-reveal">
          <div className="mb-20">
            <SectionLabel label="Hospitality, Reimagined" color={C.aqua} />
            <h2
              className="mt-8 max-w-3xl"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 'clamp(2.5rem, 4.5vw, 4rem)',
                fontWeight: 400,
                lineHeight: 1.1,
                color: C.white,
              }}
            >
              Connecting the physical experience with a <em style={{ fontStyle: 'italic', color: C.sky }}>digital platform.</em>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-end">
            <div className="md:col-span-7 img-reveal-wrapper overflow-hidden rounded-[8px]" style={{ height: '65vh', minHeight: '400px' }}>
              <img src={ABOUT_BG} className="img-reveal w-full h-full object-cover" alt="Hotel Interior" />
            </div>
            <div className="md:col-span-5 flex flex-col justify-end gap-8 pb-4">
              <div className="img-reveal-wrapper overflow-hidden rounded-[8px]" style={{ height: '40vh', minHeight: '250px' }}>
                <img src={LOGIN_BG} className="img-reveal w-full h-full object-cover" alt="Hotel details" />
              </div>
              <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: '1.15rem', color: C.white, lineHeight: 1.6, maxWidth: '400px' }}>
                Creating seamless interactions between guests, services, and hotel operations within an architecturally stunning environment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE DIFFERENTIATION STORY (Sticky GSAP ScrollTrigger) */}
      <section id="features" className="relative h-[600vh]" style={{ backgroundColor: C.surfaceLight }}>
        <div
          className="story-viewport h-screen w-full overflow-hidden px-6 md:px-12 flex flex-col justify-center border-b"
          style={{ borderColor: C.divider }}
        >
          <div className="max-w-[1550px] mx-auto w-full flex flex-col md:flex-row relative items-center gap-12 lg:gap-24">
            {/* Left: Sticky Nav */}
            <div className="w-full md:w-1/3 mb-12 md:mb-0 z-20">
              <SectionLabel label="02 — Smart Features" color={C.turquoise} />
              <h2
                className="mt-8 mb-16"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 'clamp(2rem, 3.5vw, 3.2rem)',
                  fontWeight: 400,
                  lineHeight: 1.1,
                  color: C.teal,
                }}
              >
                Everything You Need for a Seamless Stay
              </h2>
              <div className="flex flex-col gap-8">
                {[
                  'Smart Room Management',
                  'Digital Check-In',
                  'Room Booking',
                  'Service Requests',
                  'Digital Concierge',
                  'Personalised Stays',
                ].map((feature, i) => (
                  <div
                    key={i}
                    className={`story-nav-item flex items-center gap-5 transition-all duration-300 ${
                      i === 0 ? 'active opacity-100' : 'opacity-40'
                    }`}
                  >
                    <div
                      className={`nav-dot w-2 h-2 rounded-full transition-opacity duration-300 ${
                        i === 0 ? '' : 'opacity-0'
                      }`}
                      style={{ backgroundColor: C.coral }}
                    />
                    <span
                      style={{
                        fontFamily: "'Source Sans 3', sans-serif",
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        color: C.teal,
                      }}
                    >
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Scrolling Content Panels */}
            <div className="w-full md:w-2/3 h-[60vh] md:h-[75vh] relative z-10 flex items-center">
              {[
                { t: 'Smart Room Management', d: 'Control room services digitally — temperature, lighting, and amenities from one place.', img: HERO_BG },
                { t: 'Digital Check-In', d: 'Contactless registration, mobile room keys, and instant access on arrival.', img: ABOUT_BG },
                { t: 'Room Booking', d: 'Real-time availability, exclusive member rates, and personalised room recommendations.', img: LOGIN_BG },
                { t: 'Service Requests', d: 'Instant access to housekeeping, dining, maintenance, and concierge.', img: FOR_WHOM_BG },
                { t: 'Digital Concierge', d: 'Intelligent assistance for local recommendations, itineraries, and preferences.', img: CTA_BG },
                { t: 'Personalised Stays', d: 'Tailored services based on your history, preferences, and real-time needs.', img: HERO_BG },
              ].map((f, i) => (
                <div key={i} className={`story-panel-${i} absolute inset-0 flex flex-col justify-center`}>
                  <div
                    className="overflow-hidden mb-10 w-full rounded-[10px]"
                    style={{
                      height: '50vh',
                      minHeight: '300px',
                      maxHeight: '600px',
                      boxShadow: '0 20px 40px rgba(7, 94, 115, 0.08)',
                    }}
                  >
                    <img src={f.img} className={`story-img-${i} w-full h-full object-cover`} alt={f.t} />
                  </div>
                  <h3
                    className={`story-title-${i} mb-4`}
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: '2.5rem',
                      color: C.teal,
                    }}
                  >
                    {f.t}
                  </h3>
                  <p
                    className={`story-desc-${i}`}
                    style={{
                      fontFamily: "'Source Sans 3', sans-serif",
                      fontSize: '1.15rem',
                      color: C.tealDark,
                      lineHeight: 1.6,
                      maxWidth: '550px',
                    }}
                  >
                    {f.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONTRASTING SECTION: HOW IT WORKS */}
      <section id="experience" className="py-32 px-6 md:px-12" style={{ backgroundColor: C.white }}>
        <div className="max-w-[1550px] mx-auto text-reveal">
          <SectionLabel label="04 — How It Works" color={C.turquoise} />
          <h2
            className="mt-8 mb-24 max-w-3xl"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(2.5rem, 4.5vw, 4rem)',
              fontWeight: 400,
              lineHeight: 1.1,
              color: C.teal,
            }}
          >
            Your Journey, <em style={{ fontStyle: 'italic', color: C.lagoon }}>Simplified.</em>
          </h2>
          <div className="stagger-list grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-16">
            {[
              { n: '01', title: 'Discover', body: 'Explore rooms and services with intelligent recommendations shaped to your preferences.' },
              { n: '02', title: 'Book', body: 'Reserve your stay with real-time availability, instant confirmation, and seamless payment.' },
              { n: '03', title: 'Experience', body: 'Access personalised hotel services throughout your stay from one connected platform.' },
              { n: '04', title: 'Manage', body: 'Handle all requests, communications, and stay details from your smart hospitality dashboard.' },
            ].map((step) => (
              <div key={step.n} className="flex flex-col border-t pt-8" style={{ borderColor: C.divider }}>
                <span
                  className="mb-8"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: '2.8rem',
                    color: C.aqua,
                    lineHeight: 1,
                  }}
                >
                  {step.n}
                </span>
                <h3
                  className="mb-4"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: '1.8rem',
                    color: C.teal,
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: '1.1rem', color: C.tealDark, lineHeight: 1.6 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ECOSYSTEM / INTEGRATION */}
      <section id="for-whom" className="py-32 px-6 md:px-12 max-w-[1550px] mx-auto text-reveal">
        <div
          className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start p-12 lg:p-20 rounded-[12px]"
          style={{ backgroundColor: C.tealDark }}
        >
          <div className="lg:w-1/3">
            <SectionLabel label="Connecting Hospitality" color={C.aqua} />
            <h2
              className="mt-8 mb-8"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                fontWeight: 400,
                lineHeight: 1.1,
                color: C.white,
              }}
            >
              One Platform. Every Touchpoint.
            </h2>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: '1.15rem', color: C.white, opacity: 0.9, lineHeight: 1.6 }}>
              A unified ecosystem that brings together guests, staff, and management.
            </p>
          </div>
          <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-16 stagger-list">
            {[
              { role: 'Guests', body: 'Book rooms, manage stays, access services, and control your entire hotel experience from one place.' },
              { role: 'Hotel Staff', body: 'Manage requests, coordinate services, and handle operational tasks efficiently and responsively.' },
              { role: 'Management', body: 'Comprehensive oversight of operations, guest satisfaction metrics, and service delivery.' },
            ].map((a) => (
              <div key={a.role} className="flex flex-col border-l pl-8" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                <h3
                  className="mb-4"
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: '1.6rem',
                    color: C.white,
                  }}
                >
                  {a.role}
                </h3>
                <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: '1.05rem', color: C.white, opacity: 0.8, lineHeight: 1.6 }}>
                  {a.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LARGE CTA SECTION */}
      <section className="relative px-6 md:px-12 py-40 text-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={CTA_BG} className="w-full h-full object-cover" alt="Luxury resort view" />
        </div>
        <div
          className="absolute inset-0 z-10"
          style={{ background: 'linear-gradient(135deg, rgba(7, 94, 115, 0.8) 0%, rgba(7, 94, 115, 0.4) 100%)' }}
        />
        <div className="relative z-20 max-w-4xl mx-auto flex flex-col items-center text-reveal">
          <SectionLabel label="Experience Reimagined" color={C.aqua} />
          <h2
            className="mt-10 mb-14"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(3rem, 6vw, 5.5rem)',
              fontWeight: 400,
              lineHeight: 1.05,
              color: C.white,
            }}
          >
            Ready to Enter <em style={{ fontStyle: 'italic', color: C.sky }}>the Resort?</em>
          </h2>
          <EnterButton onClick={onEnterResort} disabled={enterClicked} />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-24 px-6 md:px-12" style={{ backgroundColor: C.teal, color: C.white }}>
        <div className="container mx-auto max-w-[1550px]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
            <div className="md:col-span-2">
              <p
                className="mb-8"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  color: C.white,
                }}
              >
                SMART HOTEL
              </p>
              <p
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: '1.05rem',
                  lineHeight: 1.75,
                  color: C.white,
                  opacity: 0.85,
                  maxWidth: '400px',
                }}
              >
                Intelligent hospitality that connects guests, services, and operations in one seamless digital experience.
              </p>
            </div>
            <div>
              <p
                className="mb-8"
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: C.aqua,
                }}
              >
                Properties
              </p>
              <div
                className="flex flex-col gap-5"
                style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: '1rem', color: C.white }}
              >
                <span className="cursor-pointer transition-colors opacity-80 hover:opacity-100 hover:text-aqua">
                  Mumbai Central
                </span>
                <span className="cursor-pointer transition-colors opacity-80 hover:opacity-100 hover:text-aqua">
                  Delhi NCR
                </span>
                <span className="cursor-pointer transition-colors opacity-80 hover:opacity-100 hover:text-aqua">
                  Bengaluru Tech
                </span>
                <span style={{ color: C.turquoise, fontSize: '0.85rem', marginTop: '0.5rem' }}>Expanding Soon</span>
              </div>
            </div>
            <div>
              <p
                className="mb-8"
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: C.aqua,
                }}
              >
                Contact
              </p>
              <div
                className="flex flex-col gap-5"
                style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: '1rem', color: C.white }}
              >
                <span className="cursor-pointer transition-colors opacity-80 hover:opacity-100 hover:text-aqua">
                  stay@smarthotel.com
                </span>
                <span className="cursor-pointer transition-colors opacity-80 hover:opacity-100 hover:text-aqua">
                  +91 1800 SMART HOTEL
                </span>
                <span className="cursor-pointer transition-colors opacity-80 hover:opacity-100 hover:text-aqua">
                  24 / 7 Digital Concierge
                </span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '2.5rem' }}>
            <p
              style={{
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: '0.9rem',
                color: C.white,
                opacity: 0.6,
                letterSpacing: '0.04em',
              }}
            >
              © 2024 Smart Hotel. Intelligent Hospitality for the Modern World.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function NavLink({
  label,
  onClick,
  scrolled = false,
}: {
  label: string
  onClick: () => void
  scrolled?: boolean
}) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setActive(false)
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      className="relative transition-all duration-300 flex items-center justify-center px-6 py-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
      style={{
        fontFamily: "'Source Sans 3', sans-serif",
        fontSize: '0.85rem',
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: scrolled ? C.teal : C.white,
        background: active
          ? scrolled
            ? 'rgba(7, 94, 115, 0.15)'
            : 'rgba(255, 255, 255, 0.10)'
          : hover
            ? scrolled
              ? 'rgba(7, 94, 115, 0.10)'
              : 'rgba(255, 255, 255, 0.08)'
            : scrolled
              ? 'rgba(7, 94, 115, 0.04)'
              : 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        border: `1px solid ${
          scrolled
            ? hover
              ? 'rgba(7, 94, 115, 0.35)'
              : 'rgba(7, 94, 115, 0.15)'
            : hover
              ? 'rgba(255, 255, 255, 0.35)'
              : 'rgba(255, 255, 255, 0.25)'
        }`,
        borderRadius: '28px',
        cursor: 'pointer',
        boxShadow: '0 3px 12px rgba(0, 35, 50, 0.06)',
        transform: hover && !active ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      {label}
      <span
        className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full transition-all duration-300"
        style={{
          backgroundColor: C.turquoise,
          opacity: hover || active ? 1 : 0,
          transform: hover || active ? 'scale(1) translateX(-50%)' : 'scale(0) translateX(-50%)',
        }}
      />
    </button>
  )
}

function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <p
      style={{
        fontFamily: "'Source Sans 3', sans-serif",
        fontSize: '0.8rem',
        fontWeight: 600,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: color,
      }}
    >
      {label}
    </p>
  )
}

function EnterButton({
  onClick,
  disabled,
  small = false,
  fullWidth = false,
  scrolled = false,
}: {
  onClick: () => void
  disabled?: boolean
  small?: boolean
  fullWidth?: boolean
  scrolled?: boolean
}) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)

  const baseStyle: React.CSSProperties = {
    fontFamily: "'Source Sans 3', sans-serif",
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: fullWidth ? 'center' : 'flex-start',
    gap: '0.6rem',
    transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
    color: scrolled ? C.teal : C.white,
    background: active
      ? scrolled
        ? 'rgba(7, 94, 115, 0.15)'
        : 'rgba(255, 255, 255, 0.10)'
      : hover && !disabled
        ? scrolled
          ? 'rgba(7, 94, 115, 0.10)'
          : 'rgba(255, 255, 255, 0.08)'
        : scrolled
          ? 'rgba(7, 94, 115, 0.04)'
          : 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    border: `1px solid ${
      scrolled
        ? hover && !disabled
          ? 'rgba(7, 94, 115, 0.35)'
          : 'rgba(7, 94, 115, 0.15)'
        : hover && !disabled
          ? 'rgba(255, 255, 255, 0.35)'
          : 'rgba(255, 255, 255, 0.25)'
    }`,
    borderRadius: '28px',
    boxShadow: '0 3px 12px rgba(0, 35, 50, 0.06)',
    transform: hover && !disabled && !active ? 'translateY(-1px)' : 'translateY(0)',
    ...(small
      ? { fontSize: '0.8rem', padding: '0.6rem 1.5rem', height: '42px', borderRadius: '26px' }
      : { fontSize: '0.9rem', padding: '1.2rem 2.8rem', height: '60px' }),
    ...(fullWidth ? { width: '100%' } : {}),
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={baseStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setActive(false)
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
    >
      Enter Resort
      <ArrowRight size={small ? 16 : 18} strokeWidth={2} />
    </button>
  )
}
