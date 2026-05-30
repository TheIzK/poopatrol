import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref')
  if (!ref) return new Response('Missing ref', { status: 400 })

  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return new Response('Server misconfigured', { status: 500 })

  const url = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=600&key=${key}`

  try {
    const res = await fetch(url)
    if (!res.ok) return new Response('Photo not found', { status: 404 })

    const buffer = await res.arrayBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch {
    return new Response('Failed to fetch photo', { status: 502 })
  }
}
