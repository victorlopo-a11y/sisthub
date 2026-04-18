import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseConfigError =
  supabaseConfigured
    ? null
    : 'Supabase não configurado. Crie um arquivo `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (veja `.env.example`).';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
