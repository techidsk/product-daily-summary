import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client using the service_role key (bypasses RLS).
// NEVER expose this key to the browser — it stays in server env only.
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

export const hasSupabase = Boolean(url && key)

export const supabase = hasSupabase
  ? createClient(url, key, { auth: { persistSession: false } })
  : null
