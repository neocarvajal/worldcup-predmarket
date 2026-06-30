import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const APP_URL = Deno.env.get("APP_URL") || "https://worldcup-hackathon.vercel.app";

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (_req, _ctx) => {
    try {
      const resp = await fetch(`${APP_URL}/api/keeper/settle`, { method: "POST" });
      const data = await resp.json();
      return Response.json(data, { status: resp.status });
    } catch (err: any) {
      console.error("Keeper proxy error:", err);
      return Response.json({ ok: false, error: err.message }, { status: 500 });
    }
  }),
};
