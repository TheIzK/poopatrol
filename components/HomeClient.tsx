'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RestroomLocationSummary } from '@/types'
import LocationCard from '@/components/LocationCard'

type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'ready'; lat: number; lng: number }

const SEARCH_RADIUS_MILES = 100

export default function HomeClient() {
  const searchParams = useSearchParams()
  const submitted = searchParams.get('submitted')
  const added = searchParams.get('added')

  const [location, setLocation] = useState<LocationState>({ status: 'idle' })
  const [locations, setLocations] = useState<RestroomLocationSummary[]>([])
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  function requestLocation() {
    setLocation({ status: 'loading' })
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ status: 'ready', lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => setLocation({ status: 'denied' }),
      { timeout: 10000 }
    )
  }

  useEffect(() => {
    requestLocation()
  }, [])

  useEffect(() => {
    if (location.status !== 'ready') return

    const { lat, lng } = location
    let cancelled = false

    async function load() {
      setFetching(true)
      setFetchError(null)

      const { data, error } = await supabase.rpc('nearby_restroom_locations', {
        user_lat: lat,
        user_lng: lng,
        radius_miles: SEARCH_RADIUS_MILES,
      })

      if (cancelled) return

      if (error) {
        setFetchError(error.message)
        setLocations([])
      } else {
        setLocations((data as RestroomLocationSummary[]) ?? [])
      }
      setFetching(false)
    }

    load()
    return () => { cancelled = true }
  }, [location])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">💩</span>
          <span className="font-bold text-lg tracking-tight">PooPatrol</span>
        </div>
        <Link
          href="/add-bathroom"
          className="text-sm font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          + Add
        </Link>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto flex flex-col gap-4">
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm font-medium">
            Review submitted — thanks!
          </div>
        )}
        {added && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm font-medium">
            Location added — thanks for contributing!
          </div>
        )}

        {(location.status === 'idle' || location.status === 'loading') && (
          <div className="text-center py-16 text-gray-400 text-sm">Getting your location…</div>
        )}

        {location.status === 'denied' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center flex flex-col gap-3">
            <p className="text-yellow-800 font-medium">Location access needed</p>
            <p className="text-yellow-700 text-sm">
              PooPatrol needs your location to find nearby restrooms.
            </p>
            <button
              onClick={requestLocation}
              className="mx-auto bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {location.status === 'ready' && fetching && (
          <div className="text-center py-16 text-gray-400 text-sm">Finding restrooms nearby…</div>
        )}

        {location.status === 'ready' && !fetching && fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            Failed to load: {fetchError}
          </div>
        )}

        {location.status === 'ready' && !fetching && !fetchError && locations.length === 0 && (
          <div className="text-center py-16 flex flex-col gap-3">
            <p className="text-gray-500 text-sm">No restrooms found within {SEARCH_RADIUS_MILES} miles.</p>
            <Link
              href="/add-bathroom"
              className="mx-auto text-amber-600 font-medium text-sm underline underline-offset-2"
            >
              Be the first to add one →
            </Link>
          </div>
        )}

        {location.status === 'ready' && !fetching && locations.length > 0 && (
          <>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {locations.length} restroom{locations.length === 1 ? '' : 's'} within {SEARCH_RADIUS_MILES} miles
            </p>
            {locations.map(loc => (
              <LocationCard key={loc.id} location={loc} />
            ))}
          </>
        )}
      </main>
    </div>
  )
}
