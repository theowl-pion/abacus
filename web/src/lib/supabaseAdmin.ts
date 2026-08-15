import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Only ever import this from server-side
// code (route handlers, server components). The `server-only` import above
// makes any accidental client-side import a build-time error.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
