import { body, database, guard, InputError, json, randomSlug, routeError, validateDestination, validateSlug, validateTitle } from "@/lib/links-server";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    guard(request);
    const result = await database().prepare("SELECT slug, destination, title, created_at AS \"createdAt\", clicks, active FROM links ORDER BY created_at DESC, slug ASC").all();
    return json({ links: result.results });
  } catch (e) { return routeError(e); }
}

export async function POST(request: Request) {
  try {
    const input = await body(request);
    guard(request, true);
    const destination = validateDestination(input.destination, new URL(request.url).origin);
    const title = validateTitle(input.title, destination);
    const custom = input.slug !== undefined && input.slug !== "";
    const chosen = custom ? validateSlug(input.slug) : null;
    const db = database();
    const now = Date.now();
    const counts = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) AS recent FROM links").bind(now - 60_000).first<{ total: number; recent: number }>();
    if ((counts?.total ?? 0) >= 5000) throw new InputError("This workspace holds up to 5,000 links. Export your links before making room.", 429);
    if ((counts?.recent ?? 0) >= 30) throw new InputError("You've made lots of links. Please wait one minute and try again.", 429);
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = chosen || randomSlug();
      const result = await db.prepare("INSERT INTO links (slug, destination, title, created_at, clicks, active) VALUES (?, ?, ?, ?, 0, 1) ON CONFLICT(slug) DO NOTHING").bind(slug, destination, title, now).run();
      if (result.meta.changes) return json({ link: { slug, destination, title, createdAt: now, clicks: 0, active: 1 } }, 201);
      if (chosen) throw new InputError("That ending is already taken. Choose another one.", 409);
    }
    throw new InputError("Couldn't find a free ending. Please try again.", 503);
  } catch (e) { return routeError(e); }
}
