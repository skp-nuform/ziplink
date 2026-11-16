import { randomInt } from "node:crypto";
export { database } from "./database";
import { ownerAccess } from "./authorization";

export const noCache = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: noCache });
}
export class InputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function guard(request: Request, write = false) {
  const url = new URL(request.url);
  if (!ownerAccess(request.headers)) throw new InputError("Sign in to manage your links.", 401);
  const origin = request.headers.get("origin");
  if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new InputError("Open Shortly directly to manage your links.", 403);
  }
  if (write && request.headers.get("x-shortly-request") !== "1") {
    throw new InputError("This request is not allowed.", 403);
  }
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new InputError("Send a JSON request.", 415);
  const declaredLength = Number(request.headers.get("content-length") || 0);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("Enter your link first.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    // Drain modestly oversized payloads before rejecting them so the local
    // emulator can safely reuse its HTTP connection. Memory stays bounded.
    if (size > 65536) { await reader.cancel(); throw new InputError("That request is too large.", 413); }
    chunks.push(value);
  }
  if (size > 8192 || declaredLength > 8192) throw new InputError("That request is too large.", 413);
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new InputError("The request could not be read. Please try again."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new InputError("Invalid request.");
  return parsed as Record<string, unknown>;
}
export function validateDestination(value: unknown, origin: string) {
  if (typeof value !== "string" || value.trim().length > 4096) throw new InputError("Enter a web address under 4,096 characters.");
  let target: URL;
  try { target = new URL(value.trim()); } catch { throw new InputError("Enter a full web address starting with https:// or http://."); }
  if (!["http:", "https:"].includes(target.protocol) || !target.hostname) throw new InputError("Only http:// and https:// web addresses are supported.");
  if (target.username || target.password) throw new InputError("Links containing passwords or usernames are not supported.");
  if (target.origin === origin || ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) throw new InputError("Use an external website, rather than a local or Shortly link.");
  return target.href;
}
export function validateTitle(value: unknown, destination: string) {
  if (value !== undefined && typeof value !== "string") throw new InputError("The title must be text.");
  const title = typeof value === "string" ? value.trim() : "";
  if (title.length > 100) throw new InputError("Keep the title under 100 characters.");
  return title || new URL(destination).hostname.replace(/^www\./, "");
}
export function validateSlug(value: unknown) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{2,39}$/.test(value)) throw new InputError("Use 3–40 lowercase letters, numbers, hyphens or underscores for the ending.");
  return value;
}
export function randomSlug() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
}
export function routeError(error: unknown) {
  if (error instanceof InputError) return json({ error: error.message }, error.status);
  console.error("Link operation failed", error);
  return json({ error: "Couldn't save or load your links. Please try again shortly." }, 500);
}
