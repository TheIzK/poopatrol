'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function Callback() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) console.error('Auth callback error:', error.message)
        router.replace(next)
      })
    } else {
      router.replace(next)
    }
  }, [router, searchParams])

  return <p className="p-4 text-gray-400 text-sm">Signing you in…</p>
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Suspense fallback={<p className="p-4 text-gray-400 text-sm">Loading…</p>}>
        <Callback />
      </Suspense>
    </div>
  )
}
