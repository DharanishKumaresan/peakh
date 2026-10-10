import { serverClient } from '@/lib/supabase/server';
export async function GET(request: Request) {
  const url = new URL(request.url), code = url.searchParams.get('code');
  if (code) {
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return Response.redirect(new URL('/', url.origin), 303);
  }
  return Response.redirect(new URL('/?auth_error=confirmation', url.origin), 303);
}
