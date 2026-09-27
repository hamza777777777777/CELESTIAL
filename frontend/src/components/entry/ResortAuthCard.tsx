import { useState } from 'react'
import {
  Check,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { AuthService, getFriendlyErrorMessage, type AuthUser } from '@/lib/auth'
import { useRoleStore, type Role } from '@/stores/role-store'

const DUMMY_ROLES: { role: Role; label: string; email: string; uid: string; icon: string }[] = [
  { role: 'Manager', label: 'Manager', email: 'manager@smartresort.com', uid: 'dummy-manager-uid', icon: '👑' },
  { role: 'Team Head', label: 'Team Head', email: 'head@smartresort.com', uid: 'dummy-teamhead-uid', icon: '🛡️' },
  { role: 'Staff', label: 'Staff', email: 'staff@smartresort.com', uid: 'dummy-staff-uid', icon: '👷' },
  { role: 'Guest', label: 'Guest', email: 'guest@smartresort.com', uid: 'dummy-guest-uid', icon: '🛎️' },
]

interface ResortAuthCardProps {
  onSuccess: (user: AuthUser) => void
}

type AuthView = 'signin' | 'register' | 'forgot-password'

export function ResortAuthCard({ onSuccess }: ResortAuthCardProps) {
  const { setRole } = useRoleStore()

  const handleDummyLogin = (d: typeof DUMMY_ROLES[0]) => {
    setIsLoading(true)
    const user: AuthUser = {
      uid: d.uid,
      email: d.email,
      displayName: `${d.label} User`,
      role: d.role,
    }
    AuthService.persistSession(user, d.uid)
    setRole(d.role)
    onSuccess(user)
  }
  const [authMode, setAuthMode] = useState<'guest' | 'staff'>('guest')
  const [currentView, setCurrentView] = useState<AuthView>('signin')

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  // Statuses
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null)

  // Handle Sign In (Email + Password)
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setResetSuccessMessage(null)
    setIsLoading(true)

    try {
      const user = await AuthService.signInWithEmail(email, password)
      setRole(user.role)
      onSuccess(user)
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Registration (Full Name, Email, Password, Confirm Password)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setResetSuccessMessage(null)

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return
    }

    setIsLoading(true)

    try {
      const user = await AuthService.signUpWithEmail(email, password, confirmPassword, fullName)
      setRole(user.role)
      onSuccess(user)
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Google Sign In Popup
  const handleGoogleSignIn = async () => {
    setErrorMessage(null)
    setResetSuccessMessage(null)
    setIsLoading(true)

    try {
      const user = await AuthService.signInWithGoogle()
      setRole(user.role)
      onSuccess(user)
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setResetSuccessMessage(null)
    setIsLoading(true)

    try {
      await AuthService.sendPasswordReset(email)
      setResetSuccessMessage(`Password reset link sent to ${email}. Please check your inbox.`)
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="resort-water-glass-panel relative w-full max-w-[540px] rounded-3xl p-8 sm:p-10 transition-all duration-500"
    >
      {currentView === 'forgot-password' ? (
        /* ── View: Password Reset ────────────────────────────────── */
        <div className="relative z-10 space-y-6">
          <div className="text-center space-y-1.5 pb-1">
            <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              Reset your password
            </h2>
            <p className="text-[#E2E8F0] text-[15px] font-medium leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
              Enter your email to receive a secure reset link.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50/90 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1 leading-snug">{errorMessage}</div>
            </div>
          )}

          {resetSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-[#2D8CFF]/20 border border-[#2D8CFF]/40 text-white text-sm flex items-start gap-2.5">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#2D8CFF]" />
              <div className="flex-1 leading-snug">{resetSuccessMessage}</div>
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full bg-black/20 hover:bg-black/25 focus:bg-black/35 backdrop-blur-md border border-white/25 focus:border-[#2D8CFF] focus:ring-2 focus:ring-[#2D8CFF]/30 rounded-xl pl-10 pr-4 py-3.5 text-[15px] font-semibold text-white placeholder-white/60 focus:outline-none transition-all drop-shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-4 rounded-xl bg-[#2D8CFF] hover:bg-[#1A7BFA] active:bg-[#0B6EEA] text-white font-semibold text-[15px] tracking-wide transition-all shadow-[0_6px_20px_rgba(45,140,255,0.4)] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/40"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending reset link...</span>
                </>
              ) : (
                <span>Send Reset Link →</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentView('signin')
                setErrorMessage(null)
                setResetSuccessMessage(null)
              }}
              className="w-full text-center text-sm font-semibold text-[#93C5FD] hover:text-white hover:underline flex items-center justify-center gap-1.5 pt-2 cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          </form>
        </div>
      ) : (
        /* ── Main View: Sign In / Create Account ──────────────────── */
        <div className="relative z-10 space-y-6">
          {/* Header without duplicate logo or brand */}
          <div className="text-center space-y-1.5 pb-1">
            <h2 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              {currentView === 'register' ? 'Create your account' : 'Sign in'}
            </h2>
            <p className="text-[#E2E8F0] text-[15px] font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
              {currentView === 'register'
                ? 'Start your Smart Resort 360 experience.'
                : 'Access your Smart Resort 360 experience.'}
            </p>
          </div>

          {/* Mode Selector Tabs: [ Guest / User ] [ Admin / Staff ] */}
          {currentView === 'signin' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-black/20 border border-white/25 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('guest')
                  setErrorMessage(null)
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm tracking-normal transition-all cursor-pointer ${
                  authMode === 'guest'
                    ? 'bg-[#2D8CFF] text-white font-bold shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Guest / User</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('staff')
                  setErrorMessage(null)
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm tracking-normal transition-all cursor-pointer ${
                  authMode === 'staff'
                    ? 'bg-[#2D8CFF] text-white font-bold shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin / Staff</span>
              </button>
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50/90 border border-red-200 text-red-700 text-sm flex items-start gap-2.5 animate-fade-in-up">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1 leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* ── Mode 1: Guest / User ─────────────────────────────── */}
          {authMode === 'guest' ? (
            currentView === 'register' ? (
              /* Registration Form */
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name"
                    required
                    className="w-full bg-black/20 hover:bg-black/25 focus:bg-black/35 backdrop-blur-md border border-white/25 focus:border-[#2D8CFF] focus:ring-2 focus:ring-[#2D8CFF]/30 rounded-xl pl-10 pr-4 py-3.5 text-[15px] font-semibold text-white placeholder-white/60 focus:outline-none transition-all drop-shadow-xs"
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full bg-black/20 hover:bg-black/25 focus:bg-black/35 backdrop-blur-md border border-white/25 focus:border-[#2D8CFF] focus:ring-2 focus:ring-[#2D8CFF]/30 rounded-xl pl-10 pr-4 py-3.5 text-[15px] font-semibold text-white placeholder-white/60 focus:outline-none transition-all drop-shadow-xs"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 6 characters)"
                    required
                    minLength={6}
                    className="w-full bg-black/20 hover:bg-black/25 focus:bg-black/35 backdrop-blur-md border border-white/25 focus:border-[#2D8CFF] focus:ring-2 focus:ring-[#2D8CFF]/30 rounded-xl pl-10 pr-10 py-3.5 text-[15px] font-semibold text-white placeholder-white/60 focus:outline-none transition-all drop-shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                    required
                    minLength={6}
                    className="w-full bg-black/20 hover:bg-black/25 focus:bg-black/35 backdrop-blur-md border border-white/25 focus:border-[#2D8CFF] focus:ring-2 focus:ring-[#2D8CFF]/30 rounded-xl pl-10 pr-10 py-3.5 text-[15px] font-semibold text-white placeholder-white/60 focus:outline-none transition-all drop-shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 px-4 rounded-xl bg-[#2D8CFF] hover:bg-[#1A7BFA] active:bg-[#0B6EEA] text-white font-semibold text-[15px] tracking-wide transition-all shadow-[0_6px_20px_rgba(45,140,255,0.4)] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 mt-2 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/40"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <span>Create account & enter →</span>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentView('signin')
                      setErrorMessage(null)
                    }}
                    className="text-sm font-semibold text-[#93C5FD] hover:text-white hover:underline cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                  >
                    Already have an account? Sign In
                  </button>
                </div>
              </form>
            ) : (
              /* Sign In Form */
              <div className="space-y-4">
                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-white/95 hover:bg-white active:bg-white/90 border border-white text-[#0F172A] font-semibold text-sm transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.6H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.4l4.03-3.13z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.6l4.03 3.13c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <div className="flex flex-col items-start leading-tight">
                    <span className="font-semibold text-sm text-[#0F172A]">Continue with Google</span>
                    <span className="text-xs text-[#64748B]">For guests and visitors</span>
                  </div>
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-white/20 w-full" />
                  <span className="bg-transparent px-3 text-xs uppercase tracking-wider text-white/70 font-semibold drop-shadow-xs">
                    OR
                  </span>
                  <div className="border-t border-white/20 w-full" />
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="guest@example.com"
                      required
                      className="w-full bg-black/20 hover:bg-black/25 focus:bg-black/35 backdrop-blur-md border border-white/25 focus:border-[#2D8CFF] focus:ring-2 focus:ring-[#2D8CFF]/30 rounded-xl pl-10 pr-4 py-3.5 text-[15px] font-semibold text-white placeholder-white/60 focus:outline-none transition-all drop-shadow-xs"
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      className="w-full bg-black/20 hover:bg-black/25 focus:bg-black/35 backdrop-blur-md border border-white/25 focus:border-[#2D8CFF] focus:ring-2 focus:ring-[#2D8CFF]/30 rounded-xl pl-10 pr-10 py-3.5 text-[15px] font-semibold text-white placeholder-white/60 focus:outline-none transition-all drop-shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/90 pt-0.5">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-white/40 text-[#2D8CFF] focus:ring-[#2D8CFF] w-4 h-4 cursor-pointer accent-[#2D8CFF]"
                      />
                      <span>Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView('forgot-password')
                        setErrorMessage(null)
                      }}
                      className="text-[#93C5FD] hover:text-white font-semibold transition-colors cursor-pointer underline underline-offset-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 px-4 rounded-xl bg-[#2D8CFF] hover:bg-[#1A7BFA] active:bg-[#0B6EEA] text-white font-semibold text-[15px] tracking-wide transition-all shadow-[0_6px_20px_rgba(45,140,255,0.4)] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 mt-1 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/40"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing you in...</span>
                      </>
                    ) : (
                      <span>Sign in as Guest →</span>
                    )}
                  </button>

                  <div className="pt-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView('register')
                        setErrorMessage(null)
                      }}
                      className="text-sm font-semibold text-[#93C5FD] hover:text-white hover:underline cursor-pointer drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                    >
                      Don't have an account? Create one
                    </button>
                  </div>
                </form>
              </div>
            )
          ) : (
            /* ── Mode 2: Admin / Staff ────────────────────────────── */
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@smartresort360.com"
                  required
                  className="w-full bg-black/20 hover:bg-black/25 focus:bg-black/35 backdrop-blur-md border border-white/25 focus:border-[#2D8CFF] focus:ring-2 focus:ring-[#2D8CFF]/30 rounded-xl pl-10 pr-4 py-3.5 text-[15px] font-semibold text-white placeholder-white/60 focus:outline-none transition-all drop-shadow-xs"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Staff Password"
                  required
                  className="w-full bg-black/20 hover:bg-black/25 focus:bg-black/35 backdrop-blur-md border border-white/25 focus:border-[#2D8CFF] focus:ring-2 focus:ring-[#2D8CFF]/30 rounded-xl pl-10 pr-10 py-3.5 text-[15px] font-semibold text-white placeholder-white/60 focus:outline-none transition-all drop-shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-white/90 pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-white/40 text-[#2D8CFF] focus:ring-[#2D8CFF] w-4 h-4 cursor-pointer accent-[#2D8CFF]"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('forgot-password')
                    setErrorMessage(null)
                  }}
                  className="text-[#93C5FD] hover:text-white font-semibold transition-colors cursor-pointer underline underline-offset-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-4 rounded-xl bg-[#2D8CFF] hover:bg-[#1A7BFA] active:bg-[#0B6EEA] text-white font-semibold text-[15px] tracking-wide transition-all shadow-[0_6px_20px_rgba(45,140,255,0.4)] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 mt-1 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/40"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing you in...</span>
                  </>
                ) : (
                  <span>Sign in as Staff →</span>
                )}
              </button>

              <div className="p-3.5 rounded-xl bg-black/20 border border-white/20 backdrop-blur-md text-xs text-white/80 font-medium text-center leading-relaxed">
                Access is authorized by resort credentials. Select your role during Firebase account setup.
              </div>
            </form>
          )}

          {/* ── Quick Demo Login (One-Click Role Selection) ──────────── */}
          {currentView === 'signin' && (
            <div className="pt-3 border-t border-white/20 space-y-2.5">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[12px] font-bold uppercase tracking-wider text-white/80 drop-shadow-xs">
                  ⚡ Quick Demo Login
                </span>
                <span className="text-[11px] text-white/50">(Instant Role Access)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DUMMY_ROLES.map((d) => (
                  <button
                    key={d.role}
                    type="button"
                    onClick={() => handleDummyLogin(d)}
                    disabled={isLoading}
                    className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 hover:border-white/40 text-white transition-all cursor-pointer text-center group disabled:opacity-50 drop-shadow-sm shadow-sm"
                  >
                    <span className="text-xl group-hover:scale-115 transition-transform duration-200">{d.icon}</span>
                    <span className="text-xs font-bold mt-1 text-white">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
