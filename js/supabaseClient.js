// Supabase client — the only file you need to edit to point this app at your project.
//
// Find these two values in your Supabase dashboard:
//   Project Settings → API → Project URL, and Project API keys → "anon public"
// The anon key is safe to ship in client code — it has no power beyond what the
// Row Level Security policies in supabase/schema.sql allow.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Accepts name@my.yorku.ca and name@yorku.ca (case-insensitive).
export const YORKU_EMAIL_RE = /^[^\s@]+@(my\.)?yorku\.ca$/i;
