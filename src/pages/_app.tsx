import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from 'react'
import { useAuthActions } from '@/stores/authStore'
import { Toaster } from 'sonner'

export default function App({ Component, pageProps }: AppProps) {
  const { initialize } = useAuthActions()

  useEffect(() => {
    // Initialize auth store when app starts
    initialize()
  }, [initialize])

  return (
    <>
      <Component {...pageProps} />
      <Toaster position="top-right" />
    </>
  );
}