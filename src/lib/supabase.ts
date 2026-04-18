import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Lazy initialization is handled by createClient itself, 
// but we check if variables exist to avoid cryptic errors.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key missing. Please configure them in the Secrets panel.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
