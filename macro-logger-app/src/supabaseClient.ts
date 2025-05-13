import { createClient } from '@supabase/supabase-js'

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if variables are loaded correctly
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env.local file.");
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey) 