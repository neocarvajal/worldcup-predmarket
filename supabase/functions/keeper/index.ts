const APP_URL = Deno.env.get("APP_URL") || "https://worldcup-hackathon.vercel.app";

Deno.serve(async (_req) => {
  try {
    const resp = await fetch(`${APP_URL}/api/keeper/settle`, { method: "POST" });
    const data = await resp.json();
    return Response.json(data, { status: resp.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Keeper proxy error:", msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
});
