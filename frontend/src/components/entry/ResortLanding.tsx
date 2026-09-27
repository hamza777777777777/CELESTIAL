import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Compass,
  Sparkles,
  ShieldCheck,
  Users,
  LineChart,
  BedDouble,
  CheckCircle2,
  Clock,
  ChevronDown,
} from 'lucide-react'
import gsap from 'gsap'

interface ResortLandingProps {
  onEnter: () => void
}

export function ResortLanding({ onEnter }: ResortLandingProps) {
  const [isScrolled, setIsScrolled] = useState(false)

  // GSAP animation targets
  const heroImgRef = useRef<HTMLImageElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLDivElement>(null)
  const subtextRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const metricsRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLElement>(null)

  // ── Scroll Listener for Navbar Elevation ─────────────────────
  useEffect(() => {
    const handleScroll = (e?: Event) => {
      const target = e?.target as HTMLElement | undefined
      const scrollY = target?.scrollTop ?? window.scrollY ?? 0
      setIsScrolled(scrollY > 28)
    }

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', handleScroll, { capture: true })
  }, [])

  // ── GSAP Hero Entrance Sequence ──────────────────────────────
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      return
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })

      // 1. Hero image softly appears and gently settles
      if (heroImgRef.current) {
        tl.fromTo(
          heroImgRef.current,
          { scale: 1.03, opacity: 0.85 },
          { scale: 1.0, opacity: 1, duration: 3.0, ease: 'power2.out' }
        )
      }

      // 2. Navbar softly enters
      if (navRef.current) {
        tl.fromTo(
          navRef.current,
          { y: -16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.85, ease: 'power2.out' },
          0.15
        )
      }

      // 3. Small badge label
      if (badgeRef.current) {
        tl.fromTo(
          badgeRef.current,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.75 },
          0.38
        )
      }

      // 4. Headline reveal
      if (headlineRef.current) {
        tl.fromTo(
          headlineRef.current,
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.95, ease: 'power3.out' },
          0.62
        )
      }

      // 5. Supporting copy
      if (subtextRef.current) {
        tl.fromTo(
          subtextRef.current,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          0.92
        )
      }

      // 6. Primary and secondary CTAs
      if (ctaRef.current) {
        tl.fromTo(
          ctaRef.current,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.85 },
          1.15
        )
      }

      // 7. Key metrics
      if (metricsRef.current) {
        tl.fromTo(
          metricsRef.current,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          1.35
        )
      }
    })

    return () => ctx.revert()
  }, [])

  // ── Intersection Observer for Scroll Reveals ──────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
          }
        })
      },
      { threshold: 0.15 }
    )

    const revealElements = document.querySelectorAll('.resort-reveal-item')
    revealElements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="relative w-full min-h-screen bg-[#F8FAFC] text-[#0F172A] overflow-x-hidden selection:bg-sky-100 selection:text-[#1E40AF]">
      {/* ── Fixed Top Header ─────────────────────────────────────── */}
      <header
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-400 ${
          isScrolled
            ? 'bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)] py-4'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-12 flex items-center justify-between">
          {/* Brand Logo & Lotus Emblem */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-50 border border-sky-200/80 shadow-xs">
              <svg
                className="w-5 h-5 text-[#1E40AF]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C11.5 5 9 8 5 9C9 10 11.5 13 12 16C12.5 13 15 10 19 9C15 8 12.5 5 12 2Z" />
                <path
                  d="M12 16C10.5 18 9 20 6 21C9 21.5 11 22 12 22C13 22 15 21.5 18 21C15 20 13.5 18 12 16Z"
                  opacity="0.8"
                />
                <path
                  d="M12 7C12 9 10.5 11 8 11.5C10.5 12 12 14 12 16C12 14 13.5 12 16 11.5C13.5 11 12 9 12 7Z"
                  opacity="0.6"
                />
              </svg>
            </div>
            <span className="text-lg tracking-tight text-[#0F172A] font-bold">
              Smart Resort 360
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-7 text-xs font-semibold text-[#475569] tracking-widest uppercase">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="hover:text-[#1E40AF] transition-colors cursor-pointer"
              >
                Overview
              </button>
              <button
                onClick={scrollToFeatures}
                className="hover:text-[#1E40AF] transition-colors cursor-pointer"
              >
                Ecosystem
              </button>
              <button
                onClick={scrollToFeatures}
                className="hover:text-[#1E40AF] transition-colors cursor-pointer"
              >
                Operations
              </button>
              <button
                onClick={scrollToFeatures}
                className="hover:text-[#1E40AF] transition-colors cursor-pointer"
              >
                Intelligence
              </button>
            </div>

            {/* Quick Header CTA */}
            <button
              onClick={onEnter}
              data-cursor="enter"
              className="px-5 py-2.5 rounded-full border border-sky-200 bg-sky-50 text-[#1E40AF] hover:bg-[#1E3A8A] hover:text-white hover:shadow-[0_4px_16px_rgba(30,58,138,0.2)] transition-all duration-300 text-xs font-bold tracking-wider uppercase cursor-pointer"
            >
              <span>Enter Resort</span>
            </button>
          </nav>
        </div>
      </header>

      {/* ── Main Hero Section ────────────────────────────────────── */}
      <section className="relative w-full min-h-[calc(100vh-80px)] flex flex-col justify-between overflow-hidden">
        {/* Background Visual Layer */}
        <div className="absolute inset-0 pointer-events-none">
          <img
            ref={heroImgRef}
            src="/images/resort-day-hero.jpg"
            alt="Smart Resort 360 Daytime Luxury Resort"
            className="w-full h-full object-cover object-center filter brightness-[1.02] contrast-[1.01] will-change-transform"
          />

          {/* Natural Morning Sunlight Gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/75 to-transparent md:w-3/5" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F8FAFC] via-white/30 to-transparent" />

          {/* Subtle Natural Daylight Shimmer */}
          <div className="absolute top-[26%] left-[34%] w-[26%] h-[36%] rounded-3xl bg-sky-100/20 blur-3xl pointer-events-none" />

          {/* Shimmering Pool Light Reflection */}
          <div className="absolute bottom-16 right-16 w-1/3 h-1/3 rounded-full bg-cyan-200/15 blur-3xl pool-shimmer-effect" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-12 pt-16 sm:pt-24 pb-16 flex-1 flex flex-col justify-between">
          <div className="max-w-2xl space-y-6">
            {/* Small Label */}
            <div
              ref={badgeRef}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200/80 text-[#1E40AF] text-xs font-bold tracking-widest uppercase shadow-xs backdrop-blur-xs"
            >
              <Compass className="w-3.5 h-3.5 text-[#1E40AF]" />
              <span>SMART RESORT 360 • LUXURY HOSPITALITY</span>
            </div>

            {/* Main Headline */}
            <div ref={headlineRef} className="space-y-3">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-[#0F172A] tracking-tight leading-[1.06]">
                SMART <br />
                <span className="text-[#1E40AF]">
                  RESORT 360
                </span>
              </h1>
              <p className="text-[#1E40AF] text-base sm:text-xl font-semibold tracking-wide">
                Intelligent Hospitality, Beautifully Connected.
              </p>
            </div>

            {/* Supporting Copy */}
            <p
              ref={subtextRef}
              className="text-[#475569] text-base sm:text-lg leading-relaxed font-normal max-w-lg"
            >
              Smart Resort 360 seamlessly connects guests, resort operations, and staff with real-time intelligence for an unforgettable, serene luxury experience.
            </p>

            {/* Primary & Secondary CTA Buttons */}
            <div
              ref={ctaRef}
              className="pt-3 flex flex-wrap items-center gap-4"
            >
              {/* Primary CTA */}
              <button
                onClick={onEnter}
                data-cursor="enter"
                className="enter-cta-btn group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#1E3A8A] hover:bg-[#1E40AF] active:bg-[#172554] text-white font-bold text-sm tracking-wider uppercase shadow-[0_6px_22px_rgba(30,58,138,0.32)] hover:shadow-[0_10px_32px_rgba(30,58,138,0.45)] hover:-translate-y-0.5 hover:scale-[1.015] active:scale-[0.98] transition-all duration-300 cursor-pointer"
              >
                <span>ENTER RESORT</span>
                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform duration-300" />
              </button>

              {/* Secondary CTA */}
              <button
                onClick={scrollToFeatures}
                className="inline-flex items-center gap-2 px-6 py-4 rounded-full border border-slate-200 bg-white/90 hover:bg-white text-[#0F172A] font-semibold text-sm tracking-wide shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
              >
                <span>EXPLORE PLATFORM</span>
                <ChevronDown className="w-4 h-4 text-[#1E40AF]" />
              </button>
            </div>
          </div>

          {/* Key Metrics Row */}
          <div ref={metricsRef} className="pt-12 sm:pt-16 max-w-2xl">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-slate-200/80 bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-xs border">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#1E40AF]">
                  100+
                </div>
                <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-semibold mt-0.5">
                  Suites & Villas
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#1E40AF]">
                  24/7
                </div>
                <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-semibold mt-0.5">
                  Operations
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#1E40AF]">
                  98%
                </div>
                <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-semibold mt-0.5">
                  Satisfaction
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#1E40AF]">
                  Real-time
                </div>
                <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-semibold mt-0.5">
                  AI Coordination
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Intelligent Hospitality Ecosystem ─────────── */}
      <section
        ref={featuresRef}
        className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 py-20 sm:py-28 border-t border-slate-200/80"
      >
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3 resort-reveal-item">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-[#1E40AF] text-xs font-bold tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 text-[#1E40AF]" />
            <span>Product Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl text-[#0F172A] font-bold tracking-tight">
            The Intelligent Hospitality Ecosystem
          </h2>
          <p className="text-[#475569] text-base leading-relaxed">
            Engineered to unify guest delight, staff responsiveness, and operations into a single seamless daytime experience.
          </p>
        </div>

        {/* Feature Grid with Photography */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {/* Card 1: Guest Experience */}
          <div className="resort-reveal-item resort-card-hover rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col group">
            <div className="relative h-64 overflow-hidden">
              <img
                src="/images/resort-room-day.jpg"
                alt="Luxury Guest Suite"
                className="w-full h-full object-cover group-hover:scale-[1.025] transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[#0F172A] text-xs font-bold tracking-wider uppercase shadow-xs">
                <BedDouble className="w-3.5 h-3.5 text-[#1E40AF]" />
                <span>Guest Experience</span>
              </div>
            </div>
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <h3 className="text-2xl text-[#0F172A] font-bold">
                  Personalized Guest Stays
                </h3>
                <p className="text-[#475569] text-sm leading-relaxed">
                  Fast self-service check-in, real-time room amenities dispatch, personalized climate preferences, and instant digital concierge services at guests’ fingertips.
                </p>
              </div>
              <ul className="space-y-2.5 pt-2 border-t border-slate-200/80 text-xs text-[#475569] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1E40AF]" />
                  <span>Instant mobile key & verification</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1E40AF]" />
                  <span>One-touch room dining and housekeeping</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 2: Operations & Resolution */}
          <div className="resort-reveal-item resort-card-hover rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col group">
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-[#1E40AF] text-xs font-bold tracking-wider uppercase">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1E40AF]" />
                  <span>Resort Operations</span>
                </div>
                <h3 className="text-2xl text-[#0F172A] font-bold">
                  Incident Resolution & Incident Tracking
                </h3>
                <p className="text-[#475569] text-sm leading-relaxed">
                  Every maintenance request and guest inquiry is tracked live with automated priority scoring, severity escalation, and direct staff assignment.
                </p>
              </div>

              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                  <span>Active Resolution Speed</span>
                  <span className="text-[#1E40AF] font-bold">Avg. 4.8 mins</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#1E40AF] h-full w-[88%]" />
                </div>
                <div className="flex justify-between text-[11px] text-[#64748B] font-medium">
                  <span>Automated Escalation Active</span>
                  <span>100% Traceability</span>
                </div>
              </div>

              <ul className="space-y-2.5 border-t border-slate-200/80 pt-2 text-xs text-[#475569] font-medium">
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1E40AF]" />
                  <span>Zero-delay staff task alerts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1E40AF]" />
                  <span>Live status dashboard for supervisors</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 3: Staff Coordination */}
          <div className="resort-reveal-item resort-card-hover rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col group">
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-[#1E40AF] text-xs font-bold tracking-wider uppercase">
                  <Users className="w-3.5 h-3.5 text-[#1E40AF]" />
                  <span>Staff & Administration</span>
                </div>
                <h3 className="text-2xl text-[#0F172A] font-bold">
                  Role-Based Workflows & Dispatch
                </h3>
                <p className="text-[#475569] text-sm leading-relaxed">
                  Tailored views for front desk, housekeeping, engineering, and general management. Secure role switching ensures staff only access what matters.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80">
                  <div className="font-bold text-[#0F172A]">Guest / User Mode</div>
                  <div className="text-[#64748B] text-[11px] mt-1">Bookings, room controls & requests</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80">
                  <div className="font-bold text-[#0F172A]">Admin / Staff Mode</div>
                  <div className="text-[#64748B] text-[11px] mt-1">Task queues, metrics & incident log</div>
                </div>
              </div>

              <ul className="space-y-2.5 border-t border-slate-200/80 pt-2 text-xs text-[#475569] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1E40AF]" />
                  <span>Role-guarded navigation & permissions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1E40AF]" />
                  <span>Full audit log and staff task completion</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 4: Dynamic Pricing Intelligence */}
          <div className="resort-reveal-item resort-card-hover rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)] flex flex-col group">
            <div className="relative h-64 overflow-hidden">
              <img
                src="/images/resort-cabana-day.jpg"
                alt="Luxury Poolside Terrace & Cabana"
                className="w-full h-full object-cover group-hover:scale-[1.025] transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[#0F172A] text-xs font-bold tracking-wider uppercase shadow-xs">
                <LineChart className="w-3.5 h-3.5 text-[#1E40AF]" />
                <span>Revenue Intelligence</span>
              </div>
            </div>
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <h3 className="text-2xl text-[#0F172A] font-bold">
                  Dynamic Pricing & Occupancy Forecasting
                </h3>
                <p className="text-[#475569] text-sm leading-relaxed">
                  Predictive demand curves optimize RevPAR in real time while intelligent amenity recommendations elevate per-guest spending.
                </p>
              </div>
              <ul className="space-y-2.5 pt-2 border-t border-slate-200/80 text-xs text-[#475569] font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1E40AF]" />
                  <span>Automated seasonal rate suggestions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1E40AF]" />
                  <span>Amenity & cabana yield optimization</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Final Invitation Banner ───────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 pb-24">
        <div className="resort-reveal-item rounded-3xl p-10 sm:p-14 bg-gradient-to-br from-white via-sky-50/50 to-slate-100 border border-slate-200 shadow-[0_12px_40px_rgba(15,23,42,0.06)] text-center space-y-6">
          <div className="w-12 h-12 mx-auto rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-[#1E40AF]">
            <Compass className="w-6 h-6 text-[#1E40AF]" />
          </div>

          <div className="max-w-xl mx-auto space-y-2">
            <h2 className="text-3xl sm:text-4xl text-[#0F172A] font-bold tracking-tight">
              Experience Smart Resort 360
            </h2>
            <p className="text-[#475569] text-sm sm:text-base leading-relaxed">
              Step into the platform to explore real-time complaints management, room operations, and intelligence.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onEnter}
              data-cursor="enter"
              className="enter-cta-btn group relative inline-flex items-center gap-3 px-10 py-4 rounded-full bg-[#1E3A8A] hover:bg-[#1E40AF] active:bg-[#172554] text-white font-bold text-sm tracking-wider uppercase shadow-[0_6px_25px_rgba(30,58,138,0.32)] hover:shadow-[0_10px_35px_rgba(30,58,138,0.45)] hover:-translate-y-0.5 hover:scale-[1.015] active:scale-[0.98] transition-all duration-300 cursor-pointer"
            >
              <span>ENTER RESORT</span>
              <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform duration-300" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Clean Luxury Footer ─────────────────────────────────── */}
      <footer className="relative z-10 border-t border-slate-200 bg-white/80 py-8 px-6 sm:px-12 text-center text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#1E40AF]" />
            <span className="text-sm font-bold text-[#0F172A]">Smart Resort 360</span>
            <span className="text-[#94A3B8]">— Intelligent Daytime Luxury Hospitality</span>
          </div>
          <div>
            <span>© 2026 Smart Resort 360. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
