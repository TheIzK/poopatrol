'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OverallRating } from '@/types'
import { TAG_LABELS, NEGATIVE_TAGS } from '@/lib/tags'

const RATINGS: { value: OverallRating; label: string }[] = [
  { value: 1, label: 'Terrible' },
  { value: 2, label: 'Bad' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
]

type Tag = keyof typeof TAG_LABELS

// Mutually exclusive pairs — selecting one clears the other
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

type AuthStep = 'form' | 'magic-link'

export default function ReviewForm({ locationId, locationName }: Props) {
  const router = useRouter()
  const [rating, setRating] = useState<OverallRating | null>(null)
  const [tags, setTags] = useState<Set<Tag>>(new Set())
  const [authStep, setAuthStep] = useState<AuthStep>('form')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setSignedInAs(user.email)
    })
  }, [])

  function toggleTag(tag: Tag) {
    setTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
        return next
      }
      // Clear the exclusive counterpart if present
      for (const [a, b] of EXCLUSIVE_PAIRS) {
        if (tag === a) next.delete(b)
        if (tag === b) next.delete(a)
      }
      next.add(tag)
      return next
    })
  }

  async function ensureAuth(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return user.id
    const { data, error: anonErr } = await supabase.auth.signInAnonymously()
    if (!anonErr && data.user) return data.user.id
    setAuthStep('magic-link')
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) { setError('Please select a rating.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const userId = await ensureAuth()
      if (!userId) return

      const { error: insertError } = await supabase.from('restroom_reviews').insert({
        location_id: locationId,
        user_id: userId,
        overall_rating: rating,
        tags: Array.from(tags),
      })
      if (insertError) throw insertError
      router.push('/?submitted=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { error: linkError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      if (linkError) throw linkError
      setMagicLinkSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authStep === 'magic-link') {
    return (
      <div className="p-4 max-w-md mx-auto">
        <h2 className="text-lg font-semibold mb-1">Sign in to submit</h2>
        <p className="text-sm text-gray-500 mb-4">
          We&apos;ll email you a magic link — no password, and you&apos;ll stay signed in for future reviews.
        </p>
        {magicLinkSent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
            Check your email and click the link to sign in. You&apos;ll be brought back here automatically.
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-500 text-white py-2 px-4 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto flex flex-col gap-6 pb-10">
      {/* Location */}
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Reviewing</p>
        <p className="font-semibold text-gray-900 text-lg">{locationName}</p>
        {signedInAs && (
          <p className="text-xs text-gray-400 mt-0.5">Signed in as {signedInAs}</p>
        )}
      </div>

      {/* Rating */}
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
                rating === r.value
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 bg-white'
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

      {/* Chips */}
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

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50 hover:bg-amber-600 active:bg-amber-700 transition-colors"
      >
        {submitting ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  )
}
