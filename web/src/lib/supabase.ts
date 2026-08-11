import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function wallpaperPublicUrl(imagePath: string) {
  return supabase.storage.from("wallpapers").getPublicUrl(imagePath).data
    .publicUrl;
}
