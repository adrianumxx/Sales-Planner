import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qbufcxvafgizpabkjusy.supabase.co'
const supabaseAnonKey = 'sb_publishable_aNbQ4r0dozZ37fRUhUT9kw_t73_ShJ8'

// Custom storage for session persistence
const customStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(key)
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value)
    }
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key)
    }
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: customStorage,
  },
})

export type User = {
  id: string
  email: string
  user_metadata?: Record<string, any>
}
