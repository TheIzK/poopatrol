'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OverallRating } from '@/types'

const RATINGS: { value: OverallRating; label: string }[] = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Excellent' },
]

type BooleanField =
  | 'bathroom_open'
  | 'public_access'
  | 'tp_available'
  | 'soap_available'
  | 'hand_dryer_or_towels'
  | 'accessible'
  | 'changing_table'
  | 'customers_only'
  | 'key_required'

const AMENITY_CHIPS: { key: BooleanField; label: string }[] = [
  { key: 'bathroom_open', label: 'Bathroom Open' },
  { key: 'public_access', label: 'Public Access' },
  { key: 'tp_available', label: 'TP Available' },
  { key: 'soap_available', label: 'Soap Available' },
  { key: 'hand_dryer_or_towels', label: 'Hand Dryer/Towels' },
  { key: 'accessible', label: 'Accessible' },
  { key: 'changing_table', label: 'Changing Table' },
]

const ISSUE_CHIPS: { key: BooleanField; label: string }[] = [
  { key: 'customers_only', label: 'Customers Only' },
  { key: 'key_required', label: 'Key Required' },
]

type Props = {
  locationId: string
  locationName: string
}

type AuthStep = 'form' | 'magic-link'

export default function ReviewForm({ locationId, locationName }: Props) {
  const router = useRouter()
  const [overallRating, setOverallRating] = useState<OverallRating | null>(null)
  const [cleanlinessRating, setCleanlinessRating] = useState<OverallRating | null>(null)
  const [checkedFields, setCheckedFields] = useState<Set<BooleanField>>(new Set())
  const [notes, setNotes] = useState('')
  const [authStep, setAuthStep] = useState<AuthStep>('form')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Surface existing session in the UI so user knows they don't need to re-auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setSignedInAs(user.email ?? (user.is_anonymous ? 'anonymous' : user.id.slice(0, 8)))
      }
    })
  }, [])

  function toggleField(field: BooleanField) {
    setCheckedFields(prev => {
      const next = new Set(prev)
      next.has(field) ? next.delete(field) : next.add(field)
      return next
    })
  }

  async function ensureAuth(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return user.id

    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
    if (!anonError && anonData.user) {
      setSignedInAs('anonymous')
      return anonData.user.id
    }

    setAuthStep('magic-link')
    return null
  }

  async function submitReview(userId: string) {
    const boolFields: Partial<Record<BooleanField, boolean>> = {}
    for (const field of checkedFields) {
      boolFields[field] = true
    }

    const { error: insertError } = await supabase.from('restroom_reviews').insert({
      location_id: locationId,
      user_id: userId,
      overall_rating: overallRating,
      cleanliness_rating: cleanlinessRating ?? null,
      notes: notes.trim() || null,
      ...boolFields,
    })

    if (insertError) throw insertError
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!overallRating) {
      setError('Please select an overall rating.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const userId = await ensureAuth()
      if (!userId) return
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
      {/* Location name */}
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">Reviewing</p>
        <p className="font-semibold text-gray-900">{locationName}</p>
        {signedInAs && signedInAs !== 'anonymous' && (
          <p className="text-xs text-gray-400 mt-1">Signed in as {signedInAs}</p>
        )}
      </div>

      {/* Overall Rating (required) */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">
          Overall Rating <span className="text-red-500">*</span>
        </p>
        <div className="flex gap-2">
          {RATINGS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setOverallRating(r.value)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${
                overallRating === r.value
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <span className={`text-lg font-bold ${overallRating === r.value ? 'text-amber-600' : 'text-gray-400'}`}>
                {r.value}
              </span>
              <span className="text-xs text-gray-600 text-center leading-tight">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cleanliness Rating (optional) */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">
          Cleanliness <span className="text-gray-400 font-normal">(optional)</span>
        </p>
        <div className="flex gap-2">
          {RATINGS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setCleanlinessRating(prev => prev === r.value ? null : r.value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-colors ${
                cleanlinessRating === r.value
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <span className={`text-sm font-bold ${cleanlinessRating === r.value ? 'text-blue-600' : 'text-gray-400'}`}>
                {r.value}
              </span>
              <span className="text-xs text-gray-500 text-center leading-tight">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Amenity chips */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">What&apos;s available?</p>
        <p className="text-xs text-gray-400 mb-2">Only check what you observed — unchecked means unknown.</p>
        <div className="flex flex-wrap gap-2">
          {AMENITY_CHIPS.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleField(c.key)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                checkedFields.has(c.key)
                  ? 'bg-green-100 border-green-400 text-green-800 font-medium'
                  : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              {checkedFields.has(c.key) ? '✓ ' : ''}{c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Issue chips */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Any restrictions?</p>
        <div className="flex flex-wrap gap-2">
          {ISSUE_CHIPS.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleField(c.key)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                checkedFields.has(c.key)
                  ? 'bg-red-100 border-red-400 text-red-800 font-medium'
                  : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              {checkedFields.has(c.key) ? '✓ ' : ''}{c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">
          Notes <span className="text-gray-400 font-normal">(optional)</span>
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anything else worth knowing…"
          rows={3}
          maxLength={500}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
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
