import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function LoginPage() {
  const { login, token, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && token) navigate('/', { replace: true })
  }, [authLoading, token])

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError('')
    setName('')
    setPassword('')
    setConfirmPassword('')
  }

  const validate = (): string | null => {
    if (mode === 'register' && !name.trim()) return 'Name is required.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (mode === 'register' && password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setSubmitting(true)
    setError('')
    try {
      const payload = mode === 'register'
        ? { email, password, name: name.trim() }
        : { email, password }
      const res = await apiFetch(`/${mode}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      login(data.access_token, data.name)
      navigate('/')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const passwordTooShort = password.length > 0 && password.length < 8
  const passwordMismatch = mode === 'register' && confirmPassword.length > 0 && password !== confirmPassword

  const desktopInputClass = (hasError?: boolean) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors ${
      hasError
        ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
        : 'border-gray-200 focus:border-green-400 focus:ring-green-400'
    }`

  const mobileInputClass = (hasError?: boolean) =>
    `w-full border rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 transition-colors ${
      hasError
        ? 'border-red-400 focus:ring-red-400'
        : 'border-green-400 focus:border-green-500 focus:ring-green-300'
    }`

  return (
    <div className="min-h-screen">

      {/* ── MOBILE (hidden on sm+) ─────────────────────── */}
      <div className="flex sm:hidden flex-col min-h-screen bg-gray-100 px-6 pb-10 pt-12">

        {/* Logo + dots */}
        <div className="flex flex-col items-center mb-8">
          <img src="/money-max.png" alt="Money Max" className="w-20 h-20 object-contain" />
          <div className="flex gap-2 mt-3">
            <div className={`w-2 h-2 rounded-full transition-colors ${mode === 'login' ? 'bg-gray-300' : 'bg-green-600'}`} />
            <div className={`w-2 h-2 rounded-full transition-colors ${mode === 'login' ? 'bg-green-600' : 'bg-gray-300'}`} />
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-3xl font-bold text-gray-900 mb-1">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-sm text-gray-500 mb-7">
          {mode === 'login' ? 'Log in to your account to continue.' : 'Start tracking your spending.'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input
                type="text"
                required
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                className={mobileInputClass()}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={mobileInputClass()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={mobileInputClass(passwordTooShort)}
            />
            {passwordTooShort && (
              <p className="mt-1 text-xs text-red-500">At least 8 characters required.</p>
            )}
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={mobileInputClass(passwordMismatch)}
              />
              {passwordMismatch && (
                <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
              )}
            </div>
          )}

          {mode === 'login' && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-green-600"
                />
                Remember me
              </label>
              <button type="button" className="text-sm text-gray-600 font-medium">
                Forgot Password?
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 bg-green-600 text-white text-base font-semibold py-4 rounded-full hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Social divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-sm text-gray-500">Or</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        {/* Social buttons */}
        <div className="flex justify-center">
          <button type="button" aria-label="Sign in with Google" className="w-14 h-14 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </button>
        </div>

        {/* Mode switch */}
        <p className="text-center text-sm text-gray-500 mt-auto pt-8">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="text-green-600 font-semibold"
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>

      {/* ── DESKTOP (hidden below sm) ─────────────────── */}
      <div className="hidden sm:flex min-h-screen">
        {/* Left — green background, white auth card */}
        <div className="w-1/2 bg-green-600 flex items-center justify-center p-12">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {mode === 'login' ? 'Sign in to your Money Max account.' : 'Start tracking your spending.'}
            </p>

            <div className="flex rounded-lg border border-gray-200 p-0.5 mb-6">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    mode === m ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className={desktopInputClass()}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={desktopInputClass()}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={desktopInputClass(passwordTooShort)}
                />
                {passwordTooShort && (
                  <p className="mt-1 text-xs text-red-500">At least 8 characters required.</p>
                )}
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Confirm password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={desktopInputClass(passwordMismatch)}
                  />
                  {passwordMismatch && (
                    <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 bg-green-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>
        </div>

        {/* Right — white background, logo */}
        <div className="w-1/2 bg-white flex flex-col items-center justify-center gap-6">
          <img
            src="/money-max.png"
            alt="Money Max"
            className="w-44 h-44 object-contain"
          />
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Money Max</h1>
            <p className="mt-2 text-gray-500 text-sm">Spend smarter. Save more.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
