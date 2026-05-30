'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LocationType, AddLocationFormData, LOCATION_TYPE_LABELS } from '@/types'

const LOCATION_TYPES: LocationType[] = [
  'gas_station',
  'truck_stop',
  'travel_center',
  'rest_stop',
  'restaurant',
  'store',
  'park',
  'public_building',
  'public_restroom',
  'other',
]

export default function AddLocationForm() {
  const router = useRouter()
  const [form, setForm] = useState<AddLocationFormData>({
    name: '',
    location_type: '',
    brand: '',
    address: '',
    lat: '',
    lng: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) return
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
  }, [])

  function set(field: keyof AddLocationFormData, value: string) {
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
    if (!form.name || !form.location_type) {
      setError('Name and type are required.')
      return
    }
    if (!form.lat || !form.lng) {
      setError('Coordinates are required. Allow location access or enter them manually.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const userId = await ensureAuth()
      const { error: insertError } = await supabase.from('restroom_locations').insert({
        name: form.name.trim(),
        location_type: form.location_type,
        brand: form.brand.trim() || null,
        address: form.address.trim() || null,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        source: 'user_submitted',
        source_id: null,
        seeded: false,
        ...(userId ? { created_by: userId } : {}),
      })
      if (insertError) throw insertError
      router.push('/?added=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add location.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto flex flex-col gap-4 pb-10">
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={form.location_type}
          onChange={e => set('location_type', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        >
          <option value="">Select type…</option>
          {LOCATION_TYPES.map(t => (
            <option key={t} value={t}>{LOCATION_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Brand / Chain</label>
        <input
          type="text"
          value={form.brand}
          onChange={e => set('brand', e.target.value)}
          placeholder="e.g. Pilot, Shell, Love's"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input
          type="text"
          value={form.address}
          onChange={e => set('address', e.target.value)}
          placeholder="123 Exit Rd, Nashville, TN"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Latitude{locating && <span className="text-gray-400 font-normal"> (detecting…)</span>}
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

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50 hover:bg-amber-600 active:bg-amber-700 transition-colors mt-2"
      >
        {submitting ? 'Adding…' : 'Add Location'}
      </button>
    </form>
  )
}
