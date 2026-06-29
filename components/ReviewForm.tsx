'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OverallRating } from '@/types'
import { TAG_LABELS, NEGATIVE_TAGS } from '@/lib/tags'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback': () => void
        'error-callback': () => void
      }) => string
    }
  }
}

const RATINGS: { value: OverallRating; label: string }[] = [
  { value: 1, label: 'Terrible' },
  { value: 2, label: 'Bad' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
]

type Tag = keyof typeof TAG_LABELS

const EXCLUSIVE_PAIRS: [Tag, Tag][] = [
  ['clean', 'dirty'],
  ['has_tp', 'no_tp'],
  ['has_soap', 'no_soap'],
  ['public', 'customers_only'],
]

const CHIPS = Object.entries(TAG_LABELS).map(([key, label]) => ({ key: key as Tag, label }))

type Props = {
  locationId: string
  locationName: string
}

export default function ReviewForm({ locationId, locationName }: Props) {
  const router = useRouter()
  const [rating, setRating] = useState<OverallRating | null>(null)
  const [tags, setTags] = useState<Set<Tag>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function initAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { setAccessToken(session.access_token); return }
      const { data } = await supabase.auth.signInAnonymously()
      if (data.session) setAccessToken(data.session.access_token)
    }
    initAuth()
  }, [])

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => {
      if (turnstileRef.current && window.turnstile) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
          callback: (token) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(null),
          'error-callback': () => setTurnstileToken(null),
        })
      }
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  function toggleTag(tag: Tag) {
    setTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) { next.delete(tag); return next }
      for (const [a, b] of EXCLUSIVE_PAIRS) {
        if (tag === a) next.delete(b)
        if (tag === b) next.delete(a)
      }
      next.add(tag)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) { setError('Please select a rating.'); return }
    if (!turnstileToken) { setError('Bot check not complete. Please wait a moment.'); return }
    if (!accessToken) { setError('Session not ready. Please refresh and try again.'); return }

    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ turnstileToken, locationId, rating, tags: Array.from(tags) }),
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong.')
      router.push('/?submitted=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto flex flex-col gap-6 pb-10">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Reviewing</p>
        <p className="font-semibold text-gray-900 text-lg">{locationName}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          How was the bathroom? <span className="text-red-500">*</span>
        </p>
        <div className="flex gap-2">
          {RATINGS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRating(r.value)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${
                rating === r.value ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className={`text-lg font-bold leading-none ${rating === r.value ? 'text-amber-600' : 'text-gray-400'}`}>
                {r.value}
              </span>
              <span className="text-xs text-gray-600 leading-tight text-center">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-1">Tap anything you noticed</p>
        <p className="text-xs text-gray-400 mb-3">Unselected = unknown. Only tap what you actually saw.</p>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map(c => {
            const selected = tags.has(c.key)
            const negative = NEGATIVE_TAGS.has(c.key)
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleTag(c.key)}
                className={`px-3 py-2 rounded-full text-sm border transition-colors font-medium ${
                  selected
                    ? negative
                      ? 'bg-red-100 border-red-400 text-red-800'
                      : 'bg-green-100 border-green-400 text-green-800'
                    : 'bg-white border-gray-300 text-gray-600'
                }`}
              >
                {selected ? '✓ ' : ''}{c.label}
              </button>
            )
          })}
        </div>
      </div>

      <div ref={turnstileRef} />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !turnstileToken || !accessToken}
        className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50 hover:bg-amber-600 active:bg-amber-700 transition-colors"
      >
        {submitting ? 'Submitting…' : !turnstileToken ? 'Verifying…' : 'Submit Review'}
      </button>
    </form>
  )
}
