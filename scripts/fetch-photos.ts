/**
 * Download Google Places photos and store them in Supabase Storage.
 *
 * Prerequisites:
 *   1. Create a public Storage bucket named "photos" in Supabase dashboard
 *   2. SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   3. GOOGLE_PLACES_API_KEY in .env.local
 *
 * Run:
 *   npx tsx scripts/fetch-photos.ts
 *
 * Re-run safe: skips locations that already have metadata.photo_url set.
 * After this runs, LocationCard uses metadata.photo_url directly — no proxy needed.
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
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const PLACES_KEY   = process.env.GOOGLE_PLACES_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!PLACES_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const BUCKET      = 'photos'
const PAGE_SIZE   = 200
const DELAY_MS    = 80  // ~12 req/sec

// ── Types ─────────────────────────────────────────────────────────────────────

type LocationRow = {
  id: string
  metadata: Record<string, unknown>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function downloadPhoto(photoName: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${PLACES_KEY}`
  const res = await fetch(url)
  if (!res.ok) return null
  const buffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  return { buffer, contentType }
}

function getExtension(contentType: string): string {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  return 'jpg'
}

async function uploadToStorage(
  locationId: string,
  buffer: ArrayBuffer,
  contentType: string
): Promise<string | null> {
  const ext = getExtension(contentType)
  const path = `${locationId}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true })

  if (error) {
    console.error(`\nStorage upload failed for ${locationId}: ${error.message}`)
    return null
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function processLocation(loc: LocationRow): Promise<boolean> {
  const photoName = loc.metadata?.google_photo_name as string | undefined
  if (!photoName) return false

  const photo = await downloadPhoto(photoName)
  if (!photo) return false

  const publicUrl = await uploadToStorage(loc.id, photo.buffer, photo.contentType)
  if (!publicUrl) return false

  const updatedMetadata = { ...loc.metadata, photo_url: publicUrl }
  const { error } = await supabase
    .from('restroom_locations')
    .update({ metadata: updatedMetadata })
    .eq('id', loc.id)

  if (error) {
    console.error(`\nMetadata update failed for ${loc.id}: ${error.message}`)
    return false
  }

  return true
}

// ── Core ──────────────────────────────────────────────────────────────────────

async function fetchPage(afterId: string | null): Promise<LocationRow[]> {
  let query = supabase
    .from('restroom_locations')
    .select('id, metadata')
    .order('id')
    .limit(PAGE_SIZE)

  if (afterId) query = query.gt('id', afterId)

  const { data, error } = await query
  if (error) throw new Error(`Fetch failed: ${error.message}`)
  return (data ?? []) as LocationRow[]
}

async function main() {
  console.log('Starting photo download + upload to Supabase Storage…')
  console.log(`Bucket: ${BUCKET}`)

  let lastId: string | null = null
  let totalProcessed = 0
  let totalSkipped = 0
  let totalUploaded = 0
  let totalNoPhoto = 0
  let errors = 0

  while (true) {
    const rows = await fetchPage(lastId)
    if (rows.length === 0) break
    lastId = rows[rows.length - 1].id

    for (const loc of rows) {
      // Skip already downloaded
      if (loc.metadata?.photo_url) {
        totalSkipped++
        continue
      }

      // Skip locations with no photo reference
      if (!loc.metadata?.google_photo_name) {
        totalNoPhoto++
        continue
      }

      try {
        const ok = await processLocation(loc)
        if (ok) totalUploaded++
        else errors++
        totalProcessed++
      } catch (err) {
        errors++
        totalProcessed++
        console.error(`\nError on ${loc.id}: ${err instanceof Error ? err.message : err}`)
      }

      process.stdout.write(
        `\r[${totalUploaded} uploaded, ${totalSkipped} skipped, ${errors} errors] processed: ${totalProcessed}`
      )

      await sleep(DELAY_MS)
    }

    if (rows.length < PAGE_SIZE) break
  }

  console.log(`\n\nDone.`)
  console.log(`  Uploaded:  ${totalUploaded}`)
  console.log(`  Skipped (already done): ${totalSkipped}`)
  console.log(`  No photo ref: ${totalNoPhoto}`)
  console.log(`  Errors: ${errors}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
