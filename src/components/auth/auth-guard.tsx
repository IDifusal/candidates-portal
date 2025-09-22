import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth, useAuthActions } from '@/stores/authStore'
import { IconLoader } from '@tabler/icons-react'
import { LoginForm } from './login-form'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
  fallback?: React.ReactNode
}

export function AuthGuard({ 
  children, 
  requireAuth = true, 
  redirectTo = '/admin/login',
  fallback 
}: AuthGuardProps) {
  const router = useRouter()
  const { user, loading, initialized, isAuthenticated } = useAuth()
  const { initialize } = useAuthActions()

  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialized, initialize])

  // Show loading while initializing auth
  if (!initialized || loading) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <IconLoader className="w-8 h-8 animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // If auth is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    // If we're already on the login page, show the login form
    if (router.pathname === '/admin/login') {
      return <LoginForm />
    }

    // Otherwise redirect to login
    router.push(`/admin/login?redirectTo=${encodeURIComponent(router.asPath)}`)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <IconLoader className="w-8 h-8 animate-spin" />
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // If auth is not required but user is authenticated, allow access
  // If auth is required and user is authenticated, allow access
  return <>{children}</>
}

// Higher-order component for pages that require authentication
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    requireAuth?: boolean
    redirectTo?: string
    fallback?: React.ReactNode
  } = {}
) {
  const AuthenticatedComponent = (props: P) => {
    return (
      <AuthGuard {...options}>
        <Component {...props} />
      </AuthGuard>
    )
  }

  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`

  return AuthenticatedComponent
}

// Hook to get current user info for components
export function useCurrentUser() {
  const { user, isAuthenticated, loading } = useAuth()
  
  return {
    user,
    isAuthenticated,
    loading,
    userId: user?.id,
    email: user?.email,
    name: user?.name,
    role: user?.role
  }
}
