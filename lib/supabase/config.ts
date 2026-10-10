export function supabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vginlyukolffgmakalmc.supabase.co',
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_34vgkyr_Asx9O00Wy0IRRQ_MI0NNCeA',
  };
}
