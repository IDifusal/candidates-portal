import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cliente con privilegios elevados para operaciones del servidor
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey)

// Cliente regular para SSR
export const supabaseServer = createClient<Database>(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)