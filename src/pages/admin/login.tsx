import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/stores/authStore'
import { LoginForm } from '@/components/auth/login-form'
import Head from 'next/head'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, loading, initialized } = useAuth()
  const { redirectTo } = router.query

  useEffect(() => {
    // If user is already authenticated, redirect them
    if (initialized && !loading && isAuthenticated) {
      const destination = typeof redirectTo === 'string' ? redirectTo : '/admin/dashboard'
      router.push(destination)
    }
  }, [isAuthenticated, loading, initialized, router, redirectTo])

  // If user is already authenticated, don't show login form
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Redirecting...</p>
      </div>
    )
  }

  const handleLoginSuccess = () => {
    const destination = typeof redirectTo === 'string' ? redirectTo : '/admin/dashboard'
    router.push(destination)
  }

  return (
    <>
      <Head>
        <title>Admin Login - Candidates Portal</title>
        <meta name="description" content="Sign in to your admin account" />
      </Head>
      
      <LoginForm 
        onSuccess={handleLoginSuccess}
        redirectTo={typeof redirectTo === 'string' ? redirectTo : '/admin/dashboard'}
      />
    </>
  )
}
