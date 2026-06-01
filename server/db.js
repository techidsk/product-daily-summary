import pg from 'pg'

// Direct Postgres (Supabase) via DATABASE_URL — server-side only.
// Return `date` (OID 1082) as a raw 'YYYY-MM-DD' string, not a JS Date,
// so history keys don't shift across timezones.
pg.types.setTypeParser(1082, (v) => v)

const connectionString = process.env.DATABASE_URL

export const hasDb = Boolean(connectionString)

export const pool = hasDb
  ? new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }, // Supabase requires SSL
      max: 4,
    })
  : null
