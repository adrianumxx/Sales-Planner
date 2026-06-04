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

        const { data: authListener } = supabase.auth.onAuthStateChange(
          (_event, newSession) => {
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
        if (data.session?.user) {
          setUser({
            id: data.session.user.id,
            email: data.session.user.email || '',
            user_metadata: data.session.user.user_metadata,
          })
          setSession(data.session)
        }

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed'
        setError(message)
        return false
      }
    },
    []
  )

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
        })

        if (signupError) throw signupError
        if (data.user) {
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
    isAuthenticated: !!user,
  }
}
