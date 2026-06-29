import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip,
    }),
  })
  const data = await res.json()
  return data.success === true
}

export async function POST(req: NextRequest) {
  try {
    const { turnstileToken, locationId, rating, tags } = await req.json()

    if (!turnstileToken || !locationId || !rating) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? ''
    const valid = await verifyTurnstile(turnstileToken, ip)
    if (!valid) {
      return NextResponse.json({ error: 'Bot check failed. Please try again.' }, { status: 403 })
    }

    const accessToken = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
    }

    const { error } = await supabase.from('restroom_reviews').insert({
      location_id: locationId,
      user_id: user.id,
      overall_rating: rating,
      tags: tags ?? [],
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You already reviewed this location.' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Review insert error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
