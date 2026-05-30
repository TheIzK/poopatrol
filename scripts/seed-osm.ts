/**
 * Seed restroom_locations from OpenStreetMap via Overpass API.
 *
 * Run:
 *   npx tsx scripts/seed-osm.ts
 *
 * Optionally override bounding box:
 *   BBOX="30.0,-90.0,36.0,-80.0" npx tsx scripts/seed-osm.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (loaded automatically from .env.local if present).
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
} catch {
  // No .env.local — rely on environment variables
}

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const BATCH_SIZE = 100

const BBOX = process.env.BBOX ?? '33.0,-85.0,34.5,-83.0'

const OVERPASS_QUERY = `
[out:json][timeout:60];
(
  node["amenity"="fuel"](${BBOX});
  way["amenity"="fuel"](${BBOX});
  relation["amenity"="fuel"](${BBOX});

  node["amenity"="toilets"](${BBOX});
  way["amenity"="toilets"](${BBOX});
  relation["amenity"="toilets"](${BBOX});

  node["highway"="rest_area"](${BBOX});
  way["highway"="rest_area"](${BBOX});
  relation["highway"="rest_area"](${BBOX});

  node["highway"="services"](${BBOX});
  way["highway"="services"](${BBOX});
  relation["highway"="services"](${BBOX});
);
out center tags;
`.trim()

// OSM tags we pull into metadata for display/enrichment
const METADATA_TAG_KEYS = [
  'opening_hours',
  'phone',
  'website',
  'wheelchair',
  'toilets:wheelchair',
  'operator',
  'brand:wikidata',
  'fee',
  'access',
  'check_date',
] as const

// ── Types ─────────────────────────────────────────────────────────────────────

type OsmElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

type LocationMetadata = {
  opening_hours?: string
  phone?: string
  website?: string
  wheelchair?: string
  toilets_wheelchair?: string
  operator?: string
  brand_wikidata?: string
  fee?: string
  access?: string
  check_date?: string
  osm_tags: Record<string, string>
}

type LocationRow = {
  name: string
  location_type: string
  brand: string | null
  address: string | null
  lat: number
  lng: number
  source: string
  source_id: string
  osm_type: string
  osm_id: string
  seeded: boolean
  metadata: LocationMetadata
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLocationType(tags: Record<string, string>): string {
  if (tags.amenity === 'fuel') return 'gas_station'
  if (tags.amenity === 'toilets') return 'public_restroom'
  if (tags.highway === 'rest_area') return 'rest_stop'
  if (tags.highway === 'services') return 'travel_center'
  return 'unknown'
}

function buildAddress(tags: Record<string, string>): string | null {
  if (tags['addr:full']) return tags['addr:full']
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:state'],
  ].filter(Boolean)
  return parts.length >= 2 ? parts.join(', ') : null
}

function buildMetadata(tags: Record<string, string>): LocationMetadata {
  const meta: LocationMetadata = { osm_tags: tags }
  if (tags.opening_hours)          meta.opening_hours     = tags.opening_hours
  if (tags.phone)                  meta.phone             = tags.phone
  if (tags.website)                meta.website           = tags.website
  if (tags.wheelchair)             meta.wheelchair        = tags.wheelchair
  if (tags['toilets:wheelchair'])  meta.toilets_wheelchair = tags['toilets:wheelchair']
  if (tags.operator)               meta.operator          = tags.operator
  if (tags['brand:wikidata'])      meta.brand_wikidata    = tags['brand:wikidata']
  if (tags.fee)                    meta.fee               = tags.fee
  if (tags.access)                 meta.access            = tags.access
  if (tags.check_date)             meta.check_date        = tags.check_date
  return meta
}

function mapElement(el: OsmElement): LocationRow | null {
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (lat == null || lon == null) return null

  const tags = el.tags ?? {}
  const name = (tags.name || tags.brand || tags.operator || '').trim()
  if (!name) return null

  return {
    name,
    location_type: getLocationType(tags),
    brand: tags.brand || tags.operator || null,
    address: buildAddress(tags),
    lat,
    lng: lon,
    source: 'openstreetmap',
    source_id: `${el.type}/${el.id}`,
    osm_type: el.type,
    osm_id: String(el.id),
    seeded: true,
    metadata: buildMetadata(tags),
  }
}

// ── Core ──────────────────────────────────────────────────────────────────────

async function fetchOverpass(query: string): Promise<OsmElement[]> {
  console.log('Querying Overpass API (this can take 15–45 seconds)…')
  const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'PooPatrol/1.0 (seed script; contact via github.com/TheIzK/poopatrol)',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Overpass responded ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = await res.json() as { elements: OsmElement[] }
  return json.elements
}

async function upsertBatch(rows: LocationRow[]): Promise<void> {
  const { error } = await supabase
    .from('restroom_locations')
    .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: false })
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
}

async function main() {
  console.log(`Bounding box: ${BBOX}`)

  const elements = await fetchOverpass(OVERPASS_QUERY)
  console.log(`Received ${elements.length} OSM elements`)

  const rows = elements.map(mapElement).filter((r): r is LocationRow => r !== null)
  const skipped = elements.length - rows.length
  console.log(`Mapped ${rows.length} valid rows (skipped ${skipped} unnamed/no-coord)`)

  if (rows.length === 0) {
    console.log('Nothing to insert.')
    return
  }

  let done = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await upsertBatch(rows.slice(i, i + BATCH_SIZE))
    done += Math.min(BATCH_SIZE, rows.length - i)
    process.stdout.write(`\rUpserted ${done}/${rows.length}…`)
  }

  console.log(`\nDone. ${done} locations seeded.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

// Suppress unused import warning
void METADATA_TAG_KEYS
