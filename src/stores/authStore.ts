import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

interface AuthUser {
  id: string
  email: string
  name?: string
  role?: string
  created_at?: string
}

interface AuthState {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  initialized: boolean
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  setUser: (user: AuthUser | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      session: null,
      loading: false,
      initialized: false,

      // Actions
      signIn: async (email: string, password: string) => {
        try {
          set({ loading: true })

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          })

          if (error) {
            return { success: false, error: error.message }
          }

          if (data.user && data.session) {
            const authUser: AuthUser = {
              id: data.user.id,
              email: data.user.email || '',
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Admin',
              role: data.user.user_metadata?.role || 'admin',
              created_at: data.user.created_at
            }

            set({
              user: authUser,
              session: data.session,
              loading: false
            })

            return { success: true }
          }

          return { success: false, error: 'No user data received' }

        } catch (error) {
          console.error('Sign in error:', error)
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'An unexpected error occurred' 
          }
        } finally {
          set({ loading: false })
        }
      },

      signUp: async (email: string, password: string, name?: string) => {
        try {
          set({ loading: true })

          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name: name || email.split('@')[0],
                role: 'admin'
              }
            }
          })

          if (error) {
            return { success: false, error: error.message }
          }

          if (data.user) {
            // If email confirmation is required, user will be null until confirmed
            if (data.session) {
              const authUser: AuthUser = {
                id: data.user.id,
                email: data.user.email || '',
                name: name || data.user.email?.split('@')[0] || 'Admin',
                role: 'admin',
                created_at: data.user.created_at
              }

              set({
                user: authUser,
                session: data.session,
                loading: false
              })
            }

            return { success: true }
          }

          return { success: false, error: 'Failed to create user' }

        } catch (error) {
          console.error('Sign up error:', error)
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'An unexpected error occurred' 
          }
        } finally {
          set({ loading: false })
        }
      },

      signOut: async () => {
        try {
          set({ loading: true })
          
          const { error } = await supabase.auth.signOut()
          
          if (error) {
            console.error('Sign out error:', error)
          }

          set({
            user: null,
            session: null,
            loading: false
          })

        } catch (error) {
          console.error('Sign out error:', error)
          set({ loading: false })
        }
      },

      initialize: async () => {
        try {
          set({ loading: true })

          // Get current session
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (error) {
            console.error('Get session error:', error)
            set({ user: null, session: null, loading: false, initialized: true })
            return
          }

          if (session?.user) {
            const authUser: AuthUser = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Admin',
              role: session.user.user_metadata?.role || 'admin',
              created_at: session.user.created_at
            }

            set({
              user: authUser,
              session,
              loading: false,
              initialized: true
            })
          } else {
            set({
              user: null,
              session: null,
              loading: false,
              initialized: true
            })
          }

          // Set up auth state listener
          supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
              const authUser: AuthUser = {
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Admin',
                role: session.user.user_metadata?.role || 'admin',
                created_at: session.user.created_at
              }

              set({
                user: authUser,
                session,
                loading: false
              })
            } else if (event === 'SIGNED_OUT') {
              set({
                user: null,
                session: null,
                loading: false
              })
            }
          })

        } catch (error) {
          console.error('Initialize auth error:', error)
          set({ 
            user: null, 
            session: null, 
            loading: false, 
            initialized: true 
          })
        }
      },

      setUser: (user: AuthUser | null) => set({ user }),
      setSession: (session: Session | null) => set({ session }),
      setLoading: (loading: boolean) => set({ loading })
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user
      })
    }
  )
)

// Hook para verificar si el usuario está autenticado
export const useAuth = () => {
  const store = useAuthStore()
  
  // Handle case where store is not yet initialized
  if (!store) {
    return {
      user: null,
      session: null,
      loading: true,
      initialized: false,
      isAuthenticated: false,
      isAdmin: false
    }
  }

  const { user, session, loading, initialized } = store
  
  return {
    user,
    session,
    loading,
    initialized,
    isAuthenticated: !!user && !!session,
    isAdmin: user?.role === 'admin'
  }
}

// Hook para acciones de autenticación
export const useAuthActions = () => {
  const store = useAuthStore()
  
  // Handle case where store is not yet initialized
  if (!store) {
    return {
      signIn: async () => ({ success: false, error: 'Store not initialized' }),
      signUp: async () => ({ success: false, error: 'Store not initialized' }),
      signOut: async () => {},
      initialize: async () => {}
    }
  }

  const { signIn, signUp, signOut, initialize } = store
  
  return {
    signIn,
    signUp,
    signOut,
    initialize
  }
}
