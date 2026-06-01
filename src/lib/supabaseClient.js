import { createClient } from '@supabase/supabase-js'

// Browser-side Supabase client using the publishable (anon) key — safe to ship.
// Reads only; RLS allows anon SELECT on repos/snapshots/rankings.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key ? createClient(url, key) : null
