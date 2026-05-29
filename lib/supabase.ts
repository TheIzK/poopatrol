import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl?.startsWith('https://') || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and Vercel environment variables.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
