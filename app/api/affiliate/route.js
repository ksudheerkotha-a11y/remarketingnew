export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { searchParams } = new URL(req.url);
  const vid = searchParams.get('vid');
  if (!vid) return Response.json({ affiliate_id: null }, { headers: CORS });

  const { data } = await supabase
    .from('visitor_affiliates')
    .select('affiliate_id')
    .eq('visitor_id', vid)
    .single();

  return Response.json(
    { affiliate_id: data?.affiliate_id || null },
    { headers: CORS }
  );
}

export async function POST(req) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { visitor_id, affiliate_id } = await req.json();
  if (!visitor_id || !affiliate_id) {
    return new Response("bad request", { status: 400, headers: CORS });
  }
  await supabase
    .from('visitor_affiliates')
    .upsert({ visitor_id, affiliate_id });

  return Response.json({ ok: true }, { headers: CORS });
}
