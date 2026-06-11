import { useEffect, useState, useCallback } from 'react'
import { supabase, type User } from '../lib/supabase'

export type SignupResult =
  | { status: 'logged-in' }
  | { status: 'check-email' }
  | { status: 'error'; message: string }

export function useAuth() {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // On mount: restore session from localStorage, then listen for changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const init = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (data.session?.user) {
          setUser({
            id: data.session.user.id,
            email: data.session.user.email ?? '',
            user_metadata: data.session.user.user_metadata,
          })
        }

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
              user_metadata: session.user.user_metadata,
            })
          } else {
            setUser(null)
          }
        })

        unsubscribe = listener.subscription.unsubscribe
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Auth error')
      } finally {
        setLoading(false)
      }
    }

    init()
    return () => { unsubscribe?.() }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null)
    try {
      if (!email.endsWith('@bacardi.com')) {
        setError('Only @bacardi.com emails are authorized')
        return false
      }
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      if (data.session?.user) {
        setUser({
          id: data.session.user.id,
          email: data.session.user.email ?? '',
          user_metadata: data.session.user.user_metadata,
        })
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      return false
    }
  }, [])

  const signup = useCallback(async (email: string, password: string): Promise<SignupResult> => {
    setError(null)
    if (!email.endsWith('@bacardi.com')) {
      return { status: 'error', message: 'Only @bacardi.com emails are authorized' }
    }
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (err) return { status: 'error', message: err.message }

      // Email confirmation disabled → session is returned, log straight in.
      if (data.session?.user) {
        setUser({
          id: data.session.user.id,
          email: data.session.user.email ?? '',
          user_metadata: data.session.user.user_metadata,
        })
        return { status: 'logged-in' }
      }
      // Supabase returns a user with NO identities when the email already exists
      // (anti-enumeration) — surface it instead of a confusing silent "success".
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { status: 'error', message: 'This email is already registered — switch to “Sign in”.' }
      }
      // User created, awaiting email confirmation.
      if (data.user) return { status: 'check-email' }
      return { status: 'error', message: 'Sign-up failed' }
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : 'Sign-up failed' }
    }
  }, [])

  // Passwordless: email a 6-digit sign-in code. Creates the account on first use
  // (shouldCreateUser), so colleagues need nothing but their @bacardi.com address
  // and the code. No redirect involved — works across devices.
  const sendCode = useCallback(async (email: string): Promise<{ ok: boolean; message: string }> => {
    setError(null)
    if (!email.endsWith('@bacardi.com')) {
      return { ok: false, message: 'Only @bacardi.com emails are authorized' }
    }
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      if (err) return { ok: false, message: err.message }
      return { ok: true, message: 'Code sent — check your inbox (and spam).' }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Could not send the code' }
    }
  }, [])

  // Verify the emailed 6-digit code and start the session.
  const verifyCode = useCallback(async (email: string, token: string): Promise<{ ok: boolean; message: string }> => {
    setError(null)
    try {
      const { data, error: err } = await supabase.auth.verifyOtp({ email, token: token.trim(), type: 'email' })
      if (err) return { ok: false, message: err.message }
      if (data.session?.user) {
        setUser({
          id: data.session.user.id,
          email: data.session.user.email ?? '',
          user_metadata: data.session.user.user_metadata,
        })
        return { ok: true, message: '' }
      }
      return { ok: false, message: 'Invalid or expired code' }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Verification failed' }
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  // Kept for API compatibility but no longer used
  const checkEmailExists = useCallback(async (_email: string): Promise<boolean> => false, [])

  return {
    user,
    loading,
    error,
    login,
    signup,
    sendCode,
    verifyCode,
    logout,
    checkEmailExists,
    isAuthenticated: !!user,
  }
}
