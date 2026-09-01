// Supabase client — the only file you need to edit to point this app at your project.
//
// Find these two values in your Supabase dashboard:
//   Project Settings → API → Project URL, and Project API keys → "Publishable key"
//   (older Supabase projects call this the "anon public" key — same thing).
// This key is safe to ship in client code — it has no power beyond what the
// Row Level Security policies in supabase/schema.sql allow.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://wngygmhzbtsmyleuctxm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gcr-9H8NC7RrwkeNcPiwHQ_Baiu_5Jr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Accepts name@my.yorku.ca and name@yorku.ca (case-insensitive).
export const YORKU_EMAIL_RE = /^[^\s@]+@(my\.)?yorku\.ca$/i;
