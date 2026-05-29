import { createClient } from '@supabase/supabase-js'

/** Project URL only — e.g. https://xxxx.supabase.co (no /rest/v1 suffix). */
function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
}

const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrlRaw?.startsWith('https://') || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config: set NEXT_PUBLIC_SUPABASE_URL (https://<project>.supabase.co) and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and Vercel.'
  )
}

const supabaseUrl = normalizeSupabaseUrl(supabaseUrlRaw)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
