import { body, database, guard, InputError, json, routeError, validateDestination, validateSlug, validateTitle } from "@/lib/links-server";
type Context = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: Context) {
  try {
    const input = await body(request);
    guard(request, true);
    const slug = validateSlug((await context.params).slug);
    const db = database();
    const current = await db.prepare("SELECT * FROM links WHERE slug = ?").bind(slug).first<{ destination: string; title: string; active: number }>();
    if (!current) throw new InputError("This link no longer exists.", 404);
    const destination = input.destination === undefined ? current.destination : validateDestination(input.destination, new URL(request.url).origin);
    const title = input.title === undefined ? current.title : validateTitle(input.title, destination);
    if (input.active !== undefined && typeof input.active !== "boolean") throw new InputError("Invalid link status.");
    const active = input.active === undefined ? current.active : Number(input.active);
    const link = await db.prepare("UPDATE links SET destination = ?, title = ?, active = ? WHERE slug = ? RETURNING slug, destination, title, created_at AS \"createdAt\", clicks, active").bind(destination, title, active, slug).first();
    return json({ link });
  } catch (e) { return routeError(e); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    guard(request, true);
    const slug = validateSlug((await context.params).slug);
    const result = await database().prepare("DELETE FROM links WHERE slug = ?").bind(slug).run();
    if (!result.meta.changes) throw new InputError("This link no longer exists.", 404);
    return json({ deleted: true });
  } catch (e) { return routeError(e); }
}
