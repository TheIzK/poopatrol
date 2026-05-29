'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AddBathroomFormData } from '@/types'

const BATHROOM_TYPES = [
  { value: 'gas_station', label: 'Gas Station' },
  { value: 'rest_stop', label: 'Rest Stop' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'store', label: 'Store' },
  { value: 'park', label: 'Park' },
  { value: 'other', label: 'Other' },
]

const US_STATES = [
  'AL','AR','FL','GA','KY','LA','MD','MS','NC','SC','TN','VA','WV',
  'AK','AZ','CA','CO','CT','DE','HI','ID','IL','IN','IA','KS','ME',
  'MA','MI','MN','MO','MT','NE','NV','NH','NJ','NM','NY','ND','OH',
  'OK','OR','PA','RI','SD','TX','UT','VT','WA','WI','WY','DC',
]

export default function AddBathroomForm() {
  const router = useRouter()
  const [form, setForm] = useState<AddBathroomFormData>({
    name: '',
    address: '',
    city: '',
    state: '',
    lat: '',
    lng: '',
    interstate: '',
    exit_number: '',
    bathroom_type: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (navigator.geolocation) {
      setLocating(true)
      navigator.geolocation.getCurrentPosition(
        pos => {
          setForm(f => ({
            ...f,
            lat: pos.coords.latitude.toFixed(6),
            lng: pos.coords.longitude.toFixed(6),
          }))
          setLocating(false)
        },
        () => setLocating(false),
        { timeout: 8000 }
      )
    }
  }, [])

  function set(field: keyof AddBathroomFormData, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function ensureAuth(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return user.id
    const { data, error: anonErr } = await supabase.auth.signInAnonymously()
    if (!anonErr && data.user) return data.user.id
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.city || !form.state) {
      setError('Name, city, and state are required.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const userId = await ensureAuth()
      const { error: insertError } = await supabase.from('bathrooms').insert({
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim(),
        state: form.state,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        interstate: form.interstate.trim() || null,
        exit_number: form.exit_number.trim() || null,
        bathroom_type: form.bathroom_type || null,
        created_by: userId,
        is_seed_data: false,
        data_source: 'user_submitted',
      })
      if (insertError) throw insertError
      router.push('/?added=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bathroom.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Pilot Travel Center"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input
          type="text"
          value={form.address}
          onChange={e => set('address', e.target.value)}
          placeholder="123 Exit Rd"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.city}
            onChange={e => set('city', e.target.value)}
            placeholder="Nashville"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div className="w-24">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            State <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={form.state}
            onChange={e => set('state', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          >
            <option value="">--</option>
            {US_STATES.sort().map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Latitude {locating && <span className="text-gray-400 font-normal">(detecting…)</span>}
          </label>
          <input
            type="number"
            step="any"
            value={form.lat}
            onChange={e => set('lat', e.target.value)}
            placeholder="35.1234"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
          <input
            type="number"
            step="any"
            value={form.lng}
            onChange={e => set('lng', e.target.value)}
            placeholder="-86.7789"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Interstate</label>
          <input
            type="text"
            value={form.interstate}
            onChange={e => set('interstate', e.target.value)}
            placeholder="I-65"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div className="w-28">
          <label className="block text-sm font-medium text-gray-700 mb-1">Exit #</label>
          <input
            type="text"
            value={form.exit_number}
            onChange={e => set('exit_number', e.target.value)}
            placeholder="212"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={form.bathroom_type}
          onChange={e => set('bathroom_type', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        >
          <option value="">Select type…</option>
          {BATHROOM_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50 hover:bg-amber-600 active:bg-amber-700 transition-colors mt-2"
      >
        {submitting ? 'Adding…' : 'Add Bathroom'}
      </button>
    </form>
  )
}
