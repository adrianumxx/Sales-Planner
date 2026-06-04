import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, LogIn, Eye, EyeOff, ArrowLeft } from 'lucide-react'

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<boolean>
  onSignup?: (email: string, password: string) => Promise<boolean>
  onCheckEmail?: (email: string) => Promise<boolean>
  loading?: boolean
  error?: string | null
}

export function LoginPage({
  onLogin,
  onSignup,
  onCheckEmail,
  loading = false,
  error = null
}: LoginPageProps) {
  const [step, setStep] = useState<'email' | 'password' | 'signup'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [emailExists, setEmailExists] = useState(false)

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!email) {
      setLocalError('Inserisci una email')
      return
    }

    if (!email.endsWith('@bacardi.com')) {
      setLocalError('Usa una email @bacardi.com')
      return
    }

    setCheckingEmail(true)
    const exists = await onCheckEmail?.(email)
    setCheckingEmail(false)

    if (exists) {
      setEmailExists(true)
      setStep('password')
    } else {
      setEmailExists(false)
      setStep('signup')
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!password) {
      setLocalError('Inserisci la password')
      return
    }

    const success = await onLogin(email, password)
    if (!success && !error) {
      setLocalError('Credenziali non valide')
    }
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!password) {
      setLocalError('Scegli una password')
      return
    }

    if (password.length < 6) {
      setLocalError('La password deve essere almeno 6 caratteri')
      return
    }

    const success = await onSignup?.(email, password)
    if (!success && !error) {
      setLocalError('Errore durante la registrazione')
    }
  }

  const displayError = error || localError

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 shadow-lg mb-4">
            <span className="text-2xl">📅</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Sales Planner</h1>
          <p className="text-slate-400 text-sm">
            {step === 'email' && 'Accesso esclusivo per Bacardi'}
            {step === 'password' && `Accedi come ${email}`}
            {step === 'signup' && `Crea account: ${email}`}
          </p>
        </motion.div>

        {/* Forms */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 space-y-4 shadow-2xl"
        >
          {/* STEP 1: Email Check */}
          {step === 'email' && (
            <form onSubmit={handleCheckEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@bacardi.com"
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    disabled={checkingEmail}
                  />
                </div>
              </div>

              {displayError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                >
                  <p className="text-red-400 text-sm">{displayError}</p>
                </motion.div>
              )}

              <motion.button
                type="submit"
                disabled={checkingEmail}
                whileHover={{ scale: checkingEmail ? 1 : 1.02 }}
                whileTap={{ scale: checkingEmail ? 1 : 0.98 }}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <LogIn className="h-5 w-5" />
                {checkingEmail ? 'Verifica in corso...' : 'Continua'}
              </motion.button>

              <p className="text-xs text-slate-500 text-center pt-2">
                Usa il tuo account @bacardi.com
              </p>
            </form>
          )}

          {/* STEP 2: Login Password */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {displayError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                >
                  <p className="text-red-400 text-sm">{displayError}</p>
                </motion.div>
              )}

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <LogIn className="h-5 w-5" />
                {loading ? 'Accesso in corso...' : 'Accedi'}
              </motion.button>

              <motion.button
                type="button"
                onClick={() => {
                  setStep('email')
                  setPassword('')
                  setLocalError(null)
                }}
                className="w-full py-2 text-slate-400 hover:text-slate-300 flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Torna indietro
              </motion.button>
            </form>
          )}

          {/* STEP 3: Signup Password */}
          {step === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-4">
                <p className="text-cyan-400 text-sm">
                  ✨ Account non trovato. Crea uno nuovo con questa email.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Scegli una Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Almeno 6 caratteri"
                    autoFocus
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Min 6 caratteri</p>
              </div>

              {displayError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                >
                  <p className="text-red-400 text-sm">{displayError}</p>
                </motion.div>
              )}

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <LogIn className="h-5 w-5" />
                {loading ? 'Creazione in corso...' : 'Crea Account'}
              </motion.button>

              <motion.button
                type="button"
                onClick={() => {
                  setStep('email')
                  setPassword('')
                  setLocalError(null)
                }}
                className="w-full py-2 text-slate-400 hover:text-slate-300 flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Torna indietro
              </motion.button>
            </form>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6 text-sm text-slate-500"
        >
          <p>🔒 Accesso sicuro con Supabase</p>
        </motion.div>
      </motion.div>
    </div>
  )
}
