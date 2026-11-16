import { database, noCache, routeError } from "@/lib/links-server";
type Context = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

function missing() {
  return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link unavailable · Shortly</title><body style="margin:0;background:#f5f7f4;color:#173d31;font:18px system-ui;display:grid;place-items:center;min-height:100vh"><main style="padding:32px;max-width:440px"><p style="font-size:14px;letter-spacing:2px">SHORTLY</p><h1>This link is unavailable.</h1><p style="line-height:1.7;color:#637269">It may have been paused, deleted, or typed incorrectly.</p><a href="/" style="color:#173d31">Back to your workspace →</a></main></body></html>', { status: 404, headers: { ...noCache, "Content-Type": "text/html; charset=utf-8" } });
}
async function redirectLink(request: Request, context: Context, count: boolean) {
  try {
    // Public by design: possession of a short link is enough to follow it.
    // Link enumeration and all management operations remain owner-only.
    const { slug } = await context.params;
    if (!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(slug)) return missing();
    const query = count
      ? "UPDATE links SET clicks = clicks + 1 WHERE slug = ? AND active = 1 RETURNING destination"
      : "SELECT destination FROM links WHERE slug = ? AND active = 1";
    const row = await database().prepare(query).bind(slug).first<{ destination: string }>();
    if (!row) return missing();
    return new Response(null, { status: 302, headers: { ...noCache, Location: row.destination, "Referrer-Policy": "no-referrer" } });
  } catch (e) { return routeError(e); }
}
export async function GET(request: Request, context: Context) { return redirectLink(request, context, true); }
export async function HEAD(request: Request, context: Context) { return redirectLink(request, context, false); }
