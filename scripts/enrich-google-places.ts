/**
 * Enrich restroom_locations with Google Places data.
 *
 * Setup:
 *   1. Enable "Places API (New)" in Google Cloud Console
 *   2. Create an API key and restrict it to Places API
 *   3. Add to .env.local: GOOGLE_PLACES_API_KEY=your_key_here
 *
 * Run:
 *   npx tsx scripts/enrich-google-places.ts
 *
 * Cost estimate (using $200/month free credit):
 *   Text Search:  ~$0.032/request
 *   ~2,000 locations ≈ $64 — well within free tier
 *
 * Re-run safe: skips locations that already have google_place_id in metadata.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Load .env.local ───────────────────────────────────────────────────────────
try {
  const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = val
  }
} catch { /* rely on env */ }

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}
if (!PLACES_API_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY — add it to .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const MAX_MATCH_METERS = 150  // reject Google result if farther than this from our coords
const REQUEST_DELAY_MS = 120  // ~8 req/sec, well under the 600/min quota
const PAGE_SIZE = 200

// ── Types ─────────────────────────────────────────────────────────────────────

type LocationRow = {
  id: string
  name: string
  lat: number
  lng: number
  metadata: Record<string, unknown>
}

type PlacesResult = {
  id: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  location?: { latitude: number; longitude: number }
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  photos?: Array<{ name: string }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Haversine distance in meters */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function searchPlace(name: string, lat: number, lng: number): Promise<PlacesResult | null> {
  const res = await fetch(PLACES_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY!,
      'X-Goog-FieldMask': [
        'places.id',
        'places.location',
        'places.internationalPhoneNumber',
        'places.websiteUri',
        'places.rating',
        'places.userRatingCount',
        'places.regularOpeningHours.weekdayDescriptions',
        'places.photos',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery: name,
      maxResultCount: 1,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: MAX_MATCH_METERS,
        },
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places API ${res.status}: ${text.slice(0, 200)}`)
  }

  const json = await res.json() as { places?: PlacesResult[] }
  const place = json.places?.[0]
  if (!place) return null

  // Verify the result is actually close to our stored coordinates
  if (place.location) {
    const dist = distanceMeters(lat, lng, place.location.latitude, place.location.longitude)
    if (dist > MAX_MATCH_METERS) return null
  }

  return place
}

async function enrichLocation(loc: LocationRow): Promise<boolean> {
  const place = await searchPlace(loc.name, loc.lat, loc.lng)
  if (!place) return false

  const googleFields: Record<string, unknown> = {
    google_place_id: place.id,
  }
  if (place.internationalPhoneNumber) googleFields.google_phone       = place.internationalPhoneNumber
  if (place.websiteUri)              googleFields.google_website      = place.websiteUri
  if (place.rating != null)          googleFields.google_rating       = place.rating
  if (place.userRatingCount != null) googleFields.google_rating_count = place.userRatingCount
  if (place.regularOpeningHours?.weekdayDescriptions?.length) {
    googleFields.google_hours = place.regularOpeningHours.weekdayDescriptions
  }
  if (place.photos?.[0]) {
    googleFields.google_photo_name = place.photos[0].name
  }

  // Merge with existing metadata — don't clobber OSM fields
  const updatedMetadata = { ...loc.metadata, ...googleFields }

  const { error } = await supabase
    .from('restroom_locations')
    .update({ metadata: updatedMetadata })
    .eq('id', loc.id)

  if (error) throw new Error(`Supabase update failed for ${loc.id}: ${error.message}`)
  return true
}

// ── Core ──────────────────────────────────────────────────────────────────────

async function fetchUnenriched(offset: number): Promise<LocationRow[]> {
  const { data, error } = await supabase
    .from('restroom_locations')
    .select('id, name, lat, lng, metadata')
    .is('metadata->google_place_id' as never, null)
    .range(offset, offset + PAGE_SIZE - 1)

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`)
  return (data ?? []) as LocationRow[]
}

async function main() {
  console.log('Starting Google Places enrichment…')
  console.log(`Match threshold: ${MAX_MATCH_METERS}m`)

  let offset = 0
  let totalProcessed = 0
  let totalMatched = 0
  let apiCalls = 0

  while (true) {
    const rows = await fetchUnenriched(offset)
    if (rows.length === 0) break

    for (const loc of rows) {
      try {
        const matched = await enrichLocation(loc)
        apiCalls++
        totalProcessed++
        if (matched) totalMatched++

        process.stdout.write(
          `\r[${totalProcessed}] matched: ${totalMatched} | api calls: ${apiCalls} | last: ${loc.name.slice(0, 30).padEnd(30)}`
        )
      } catch (err) {
        console.error(`\nError on ${loc.name}: ${err instanceof Error ? err.message : err}`)
      }

      await sleep(REQUEST_DELAY_MS)
    }

    // If we matched some, offset doesn't advance the same way since matched rows
    // drop out of the unenriched filter — refetch from 0 each page
    if (rows.length < PAGE_SIZE) break
    // For unmatched rows that stay in the pool, we need to advance offset
    offset += rows.length - totalMatched
  }

  console.log(`\n\nDone.`)
  console.log(`  Processed: ${totalProcessed}`)
  console.log(`  Matched:   ${totalMatched} (${Math.round((totalMatched / totalProcessed) * 100)}%)`)
  console.log(`  API calls: ${apiCalls}`)
  console.log(`  Est. cost: ~$${(apiCalls * 0.032).toFixed(2)}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
