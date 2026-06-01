'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RestroomLocationSummary } from '@/types'
import LocationCard from '@/components/LocationCard'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm bg-gray-100">
      Loading map…
    </div>
  ),
})

type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'ready'; lat: number; lng: number }

type View = 'list' | 'map'
type Filter = 'all' | 'reviewed' | 'gas_station' | 'rest_stop'

type RadiusOption = { label: string; value: number; display: string }

const RADIUS_OPTIONS: RadiusOption[] = [
  { label: '1 mi',   value: 1,   display: 'within 1 mile' },
  { label: '5 mi',   value: 5,   display: 'within 5 miles' },
  { label: '10 mi',  value: 10,  display: 'within 10 miles' },
  { label: '25 mi',  value: 25,  display: 'within 25 miles' },
  { label: '50 mi',  value: 50,  display: 'within 50 miles' },
  { label: '100 mi', value: 100, display: 'within 100 miles' },
]

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'reviewed',    label: 'Reviewed' },
  { key: 'gas_station', label: 'Gas Stations' },
  { key: 'rest_stop',   label: 'Rest Stops' },
]

const DEFAULT_RADIUS = RADIUS_OPTIONS[1] // 5 miles

export default function HomeClient() {
  const searchParams = useSearchParams()
  const submitted = searchParams.get('submitted')
  const added = searchParams.get('added')

  const [location, setLocation] = useState<LocationState>({ status: 'idle' })
  const [radius, setRadius]     = useState<RadiusOption>(DEFAULT_RADIUS)
  const [view, setView]         = useState<View>('list')
  const [filter, setFilter]     = useState<Filter>('all')
  const [locations, setLocations] = useState<RestroomLocationSummary[]>([])
  const [fetching, setFetching]   = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  function requestLocation() {
    setLocation({ status: 'loading' })
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ status: 'ready', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation({ status: 'denied' }),
      { timeout: 10000 }
    )
  }

  useEffect(() => { requestLocation() }, [])

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
        radius_miles: radius.value,
      })
      if (cancelled) return
      if (error) { setFetchError(error.message); setLocations([]) }
      else setLocations((data as RestroomLocationSummary[]) ?? [])
      setFetching(false)
    }

    load()
    return () => { cancelled = true }
  }, [location, radius])

  const filteredLocations = useMemo(() => {
    switch (filter) {
      case 'reviewed':    return locations.filter(l => l.review_count > 0)
      case 'gas_station': return locations.filter(l => l.location_type === 'gas_station')
      case 'rest_stop':   return locations.filter(l => l.location_type === 'rest_stop' || l.location_type === 'travel_center')
      default:            return locations
    }
  }, [locations, filter])

  const isReady = location.status === 'ready'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">💩</span>
          <span className="font-bold text-lg tracking-tight">PooPatrol</span>
        </div>
        <div className="flex items-center gap-2">
          {/* List / Map toggle */}
          {isReady && (
            <div className="flex bg-white/20 rounded-lg overflow-hidden text-xs font-medium">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 transition-colors ${view === 'list' ? 'bg-white text-amber-600' : 'text-white hover:bg-white/20'}`}
              >
                List
              </button>
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1.5 transition-colors ${view === 'map' ? 'bg-white text-amber-600' : 'text-white hover:bg-white/20'}`}
              >
                Map
              </button>
            </div>
          )}
          <Link
            href="/add-bathroom"
            className="text-sm font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Add
          </Link>
        </div>
      </header>

      {/* Filter bars — only in list mode */}
      {isReady && view === 'list' && (
        <>
          {/* Distance pills */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-xs text-gray-400 shrink-0">Distance:</span>
            {RADIUS_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setRadius(opt)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  radius.label === opt.label
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:border-amber-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Type filter tabs */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filter === f.key
                    ? 'bg-gray-800 border-gray-800 text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:border-gray-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Map view */}
      {isReady && view === 'map' && (
        <div className="flex-1" style={{ height: 'calc(100dvh - 56px)' }}>
          <MapView
            locations={filteredLocations}
            userLat={(location as { lat: number }).lat}
            userLng={(location as { lng: number }).lng}
          />
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <main className="px-4 py-4 max-w-lg mx-auto w-full flex flex-col gap-4">
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
              <p className="text-yellow-700 text-sm">PooPatrol needs your location to find nearby restrooms.</p>
              <button onClick={requestLocation} className="mx-auto bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Try Again
              </button>
            </div>
          )}

          {isReady && fetching && (
            <div className="text-center py-16 text-gray-400 text-sm">Finding restrooms…</div>
          )}

          {isReady && !fetching && fetchError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              Failed to load: {fetchError}
            </div>
          )}

          {isReady && !fetching && !fetchError && filteredLocations.length === 0 && (
            <div className="text-center py-16 flex flex-col gap-3">
              <p className="text-gray-500 text-sm">
                {filter !== 'all'
                  ? 'No matching restrooms in this area. Try a different filter.'
                  : `No restrooms found ${radius.display}.`}
              </p>
              <Link href="/add-bathroom" className="mx-auto text-amber-600 font-medium text-sm underline underline-offset-2">
                Be the first to add one →
              </Link>
            </div>
          )}

          {isReady && !fetching && filteredLocations.length > 0 && (
            <>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                {filteredLocations.length} restroom{filteredLocations.length === 1 ? '' : 's'} {radius.display}
              </p>
              {filteredLocations.map(loc => (
                <LocationCard key={loc.id} location={loc} />
              ))}
            </>
          )}
        </main>
      )}
    </div>
  )
}
