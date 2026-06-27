export const dynamic = 'force-dynamic';

import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  try {
    const e = await req.json();
    if (!e || !e.v || !e.event) {
      return new Response("bad request", { status: 400, headers: CORS });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;
    const { error } = await supabase.from("events").insert({
      visitor_id: e.v,
      session_id: e.s || null,
      site_id: e.site_id || null,
      source: e.source || "organic",
      event: String(e.event).slice(0, 64),
      url: e.url || null,
      path: e.path || null,
      referrer: e.ref || null,
      title: e.title || null,
      props: e.props || {},
      ip,
      user_agent: ua,
      occurred_at: e.ts ? new Date(e.ts).toISOString() : new Date().toISOString(),
    });
    if (error) {
      console.error("insert error:", error);
      return new Response("error", { status: 500, headers: CORS });
    }
    return new Response(null, { status: 204, headers: CORS });
  } catch (err) {
    console.error("collect error:", err);
    return new Response("error", { status: 500, headers: CORS });
  }
}
