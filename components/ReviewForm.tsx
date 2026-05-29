'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PooRating, PositiveTag, IssueTag } from '@/types'

const POSITIVE_TAGS: { key: PositiveTag; label: string }[] = [
  { key: 'clean', label: 'Clean' },
  { key: 'tp_stocked', label: 'TP Stocked' },
  { key: 'soap_available', label: 'Soap Available' },
  { key: 'towels_or_dryer', label: 'Towels/Dryer' },
  { key: 'lock_worked', label: 'Lock Worked' },
  { key: 'good_privacy', label: 'Good Privacy' },
  { key: 'easy_to_find', label: 'Easy to Find' },
  { key: 'easy_highway_access', label: 'Easy Highway Access' },
  { key: 'plenty_stalls', label: 'Plenty of Stalls' },
  { key: 'felt_safe', label: 'Felt Safe' },
  { key: 'changing_table', label: 'Changing Table' },
  { key: 'kid_friendly', label: 'Kid Friendly' },
  { key: 'well_lit', label: 'Well Lit' },
  { key: 'single_user_or_family', label: 'Single/Family Room' },
]

const ISSUE_TAGS: { key: IssueTag; label: string }[] = [
  { key: 'dirty', label: 'Dirty' },
  { key: 'no_tp', label: 'No TP' },
  { key: 'no_soap', label: 'No Soap' },
  { key: 'no_towels_or_dryer', label: 'No Towels/Dryer' },
  { key: 'broken_lock', label: 'Broken Lock' },
  { key: 'poor_privacy', label: 'Poor Privacy' },
  { key: 'hard_to_find', label: 'Hard to Find' },
  { key: 'hard_highway_access', label: 'Hard Highway Access' },
  { key: 'long_line', label: 'Long Line' },
  { key: 'felt_unsafe', label: 'Felt Unsafe' },
  { key: 'not_public', label: 'Not Public' },
  { key: 'closed', label: 'Closed' },
]

const POO_RATINGS: { value: PooRating; emoji: string; label: string }[] = [
  { value: 1, emoji: '💩', label: 'Dump' },
  { value: 2, emoji: '😐', label: 'Gets It Moving' },
  { value: 3, emoji: '✨', label: 'No Wiper' },
]

type Props = {
  bathroomId: string
  bathroomName: string
}

type AuthStep = 'form' | 'magic-link'

export default function ReviewForm({ bathroomId, bathroomName }: Props) {
  const router = useRouter()
  const [pooRating, setPooRating] = useState<PooRating | null>(null)
  const [positiveTags, setPositiveTags] = useState<Set<PositiveTag>>(new Set())
  const [issueTags, setIssueTags] = useState<Set<IssueTag>>(new Set())
  const [authStep, setAuthStep] = useState<AuthStep>('form')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function togglePositive(tag: PositiveTag) {
    setPositiveTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  function toggleIssue(tag: IssueTag) {
    setIssueTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  async function ensureAuth(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return user.id

    // Try anonymous auth first
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
    if (!anonError && anonData.user) return anonData.user.id

    // Fall back to magic link flow
    setAuthStep('magic-link')
    return null
  }

  async function submitReview(userId: string) {
    const pos = Array.from(positiveTags)
    const issues = Array.from(issueTags)

    let reviewLat: number | null = null
    let reviewLng: number | null = null
    try {
      const pos2d = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      )
      reviewLat = pos2d.coords.latitude
      reviewLng = pos2d.coords.longitude
    } catch {
      // location optional for review
    }

    const { error: insertError } = await supabase.from('reviews').upsert({
      bathroom_id: bathroomId,
      user_id: userId,
      poo_rating: pooRating,
      positive_tags: pos,
      issue_tags: issues,
      review_lat: reviewLat,
      review_lng: reviewLng,
    }, { onConflict: 'bathroom_id,user_id' })

    if (insertError) throw insertError
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pooRating) {
      setError('Please select a poo rating.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const userId = await ensureAuth()
      if (!userId) return // switched to magic link flow
      await submitReview(userId)
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
        <p className="text-sm text-gray-500 mb-4">We&apos;ll send you a magic link — no password needed.</p>
        {magicLinkSent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
            Check your email for a sign-in link. Come back after clicking it to submit your review.
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
    <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">Reviewing</p>
        <p className="font-semibold text-gray-900">{bathroomName}</p>
      </div>

      {/* Poo Rating */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Rating <span className="text-red-500">*</span></p>
        <div className="flex gap-2">
          {POO_RATINGS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setPooRating(r.value)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${
                pooRating === r.value
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <span className="text-2xl">{r.emoji}</span>
              <span className="text-xs font-medium text-gray-700 text-center leading-tight">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Positive Tags */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">What was good?</p>
        <div className="flex flex-wrap gap-2">
          {POSITIVE_TAGS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => togglePositive(t.key)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                positiveTags.has(t.key)
                  ? 'bg-green-100 border-green-400 text-green-800 font-medium'
                  : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Issue Tags */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Any issues?</p>
        <div className="flex flex-wrap gap-2">
          {ISSUE_TAGS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => toggleIssue(t.key)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                issueTags.has(t.key)
                  ? 'bg-red-100 border-red-400 text-red-800 font-medium'
                  : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
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
