import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = 'http://localhost:8000'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError('')
    setPassword('')
    setConfirmPassword('')
  }

  const validate = (): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (mode === 'register' && password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      login(data.access_token)
      navigate('/')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (hasError?: boolean) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors ${
      hasError
        ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
        : 'border-gray-200 focus:border-green-400 focus:ring-green-400'
    }`

  const passwordTooShort = password.length > 0 && password.length < 8
  const passwordMismatch = mode === 'register' && confirmPassword.length > 0 && password !== confirmPassword

  return (
    <div className="min-h-screen flex">
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass()}
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
                className={inputClass(passwordTooShort)}
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
                  className={inputClass(passwordMismatch)}
                />
                {passwordMismatch && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
                )}
              </div>
            )}

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 bg-green-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>

      {/* Right — white background, black text */}
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
  )
}
