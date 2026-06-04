import { useEffect, useState, useCallback } from 'react'
import { supabase, type User } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const initAuth = async () => {
      try {
        // Handle email confirmation deep link from Supabase
        const hash = window.location.hash
        if (hash && hash.includes('access_token')) {
          try {
            // Let Supabase automatically handle the hash
            await supabase.auth.verifyOtp({
              token_hash: hash,
              type: 'recovery',
            })
          } catch (err) {
            // Silently fail - Supabase session might already be established
          }
        }

        // Get current session
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        setSession(data.session)
        if (data.session?.user) {
          setUser({
            id: data.session.user.id,
            email: data.session.user.email || '',
            user_metadata: data.session.user.user_metadata,
          })
        }

        // Listen for auth changes
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, newSession) => {
            setSession(newSession)
            if (newSession?.user) {
              setUser({
                id: newSession.user.id,
                email: newSession.user.email || '',
                user_metadata: newSession.user.user_metadata,
              })
            } else {
              setUser(null)
            }
          }
        )

        unsubscribe = authListener?.subscription?.unsubscribe || (() => {})
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Auth error'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setError(null)

        if (!email.endsWith('@bacardi.com')) {
          setError('Solo email @bacardi.com sono autorizzate')
          return false
        }

        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (loginError) throw loginError

        if (data.session) {
          setSession(data.session)
          if (data.session.user) {
            setUser({
              id: data.session.user.id,
              email: data.session.user.email || '',
              user_metadata: data.session.user.user_metadata,
            })
          }
          return true
        }

        return false
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed'
        setError(message)
        return false
      }
    },
    []
  )

  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    try {
      if (!email.endsWith('@bacardi.com')) {
        return false
      }

      const { data, error } = await supabase.auth.admin.listUsers()
      if (error) {
        // Se admin API non disponibile, assume non esiste (fallback)
        return false
      }

      return data?.users?.some(u => u.email === email) || false
    } catch (err) {
      console.error('Check email error:', err)
      return false
    }
  }, [])

  const signup = useCallback(
    async (email: string, password: string) => {
      try {
        setError(null)

        if (!email.endsWith('@bacardi.com')) {
          setError('Solo email @bacardi.com sono autorizzate')
          return false
        }

        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              autoConfirm: true,
            },
          },
        })

        if (signupError) throw signupError
        if (data.session?.user) {
          setUser({
            id: data.session.user.id,
            email: data.session.user.email || '',
            user_metadata: data.session.user.user_metadata,
          })
          setSession(data.session)
        } else if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email || '',
            user_metadata: data.user.user_metadata,
          })
        }

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Signup failed'
        setError(message)
        return false
      }
    },
    []
  )

  const logout = useCallback(async () => {
    try {
      const { error: logoutError } = await supabase.auth.signOut()
      if (logoutError) throw logoutError
      setUser(null)
      setSession(null)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed'
      setError(message)
      return false
    }
  }, [])

  return {
    user,
    session,
    loading,
    error,
    login,
    signup,
    logout,
    checkEmailExists,
    isAuthenticated: !!user,
  }
}
