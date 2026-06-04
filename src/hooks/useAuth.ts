import { useEffect, useState, useCallback } from 'react'
import { supabase, type User } from '../lib/supabase'

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
        setError('Solo email @bacardi.com sono autorizzate')
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

  const signup = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null)
    try {
      if (!email.endsWith('@bacardi.com')) {
        setError('Solo email @bacardi.com sono autorizzate')
        return false
      }
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (err) throw err
      // If session is returned immediately (email confirmation disabled), log in
      if (data.session?.user) {
        setUser({
          id: data.session.user.id,
          email: data.session.user.email ?? '',
          user_metadata: data.session.user.user_metadata,
        })
        return true
      }
      // If only user returned (email confirmation pending), still return true
      if (data.user) return true
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
      return false
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
    logout,
    checkEmailExists,
    isAuthenticated: !!user,
  }
}
