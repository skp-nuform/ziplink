import assert from "node:assert/strict";
const base = process.env.SHORTLY_TEST_URL || "http://127.0.0.1:5173";
const suffix = Date.now().toString(36);
const slug = `test-${suffix}`;
const cleanup = new Set();
let checks = 0;
let cookie = '';
function check(condition, message) { assert.ok(condition, message); checks++; console.log(`PASS ${message}`); }
async function call(path, method = "GET", data, extra = {}) {
  const response = await fetch(base + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", "X-Shortly-Request": "1", Cookie: cookie, ...extra }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const text = await response.text();
  return new Response(method === "HEAD" || response.status === 204 ? null : text, { status: response.status, headers: response.headers });
}
async function row(s) { return (await (await call("/api/links")).json()).links.find(l => l.slug === s); }
try {
  let anonymous = await call('/api/links'); check(anonymous.status === 401, 'anonymous management is blocked');
  const forged = await call('/api/links','GET',undefined,{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'}); check(forged.status===401,'forged identity headers are ignored');
  const login = await call('/api/login','POST',{password:process.env.SHORTLY_ADMIN_PASSWORD}); check(login.status===200,'owner can sign in'); cookie=(login.headers.get('set-cookie')||'').split(';')[0];
  const publicHome = await call('/', 'GET', undefined, { Cookie: '' }); const publicHtml = await publicHome.text();
  check(publicHome.status === 200 && publicHtml.includes('Where should your link go?') && !publicHtml.includes('id="password"'), 'visitors see the shortener without a password');
  check(!publicHtml.includes('Search your links') && !publicHtml.includes('Go to My links'), 'public homepage does not expose the owner dashboard');
  const ownerPage = await call('/login', 'GET', undefined, { Cookie: '' }); check(ownerPage.status === 200 && (await ownerPage.text()).includes('Your password'), 'owner sign-in remains available separately');
  const guest = await call('/api/links', 'POST', { destination:'https://example.com/public-test' }, { Cookie: '' });
  const guestLink = (await guest.json()).link; check(guest.status === 201 && /^[a-z0-9]{4}$/.test(guestLink?.slug), 'visitors can create a four-character link without signing in'); cleanup.add(guestLink.slug);
  check((await call('/' + guestLink.slug, 'HEAD', undefined, { Cookie: '' })).headers.get('location') === 'https://example.com/public-test', 'guest-created links redirect publicly');
  for (const method of ['PATCH', 'DELETE']) {
    const denied = await call('/api/links/' + guestLink.slug, method, {title:'Unauthorized'}, {Cookie:''});
    check(denied.status === 401, 'anonymous ' + method + ' remains blocked even for guest-created links');
  }
  const badOrigin = await call('/api/links', 'POST', {destination:'https://example.com'}, {Cookie:'',Origin:'https://untrusted.example'}); check(badOrigin.status === 403, 'public creation still blocks cross-origin writes');
  const badHeader = await call('/api/links', 'POST', {destination:'https://example.com'}, {Cookie:'','X-Shortly-Request':''}); check(badHeader.status === 403, 'public creation still requires the write header');
  const attempts = await Promise.all(Array.from({length:12}, () => call('/api/links', 'POST', {slug:guestLink.slug,destination:'https://example.com'}, {Cookie:''})));
  check(attempts.filter(r => r.status === 409).length === 9 && attempts.filter(r => r.status === 429).length === 3, 'guest creation limits are enforced atomically under concurrent requests');
  let r = await call("/"); check(r.status === 200 && (await r.text()).includes("More sharing."), "dashboard serves successfully");
  r = await call("/api/links", "POST", { slug, title: "Integration test", destination: "https://example.com/long/path?test=one#section" });
  check(r.status === 201, "creates a custom short link"); cleanup.add(slug);
  const record = (await r.json()).link; check(record.slug === slug && record.clicks === 0 && record.active === 1, "new link starts active with zero clicks");
  r = await call(`/${slug}`); check(r.status === 302 && r.headers.get("location") === record.destination, "redirect preserves destination, query and fragment");
  check(r.headers.get("cache-control") === "no-store", "redirect isn't cached");
  check((await row(slug)).clicks === 1, "redirect increments click count");
  r = await call(`/${slug}`, "HEAD"); check(r.status === 302 && (await row(slug)).clicks === 1, "HEAD requests do not inflate clicks");
  r = await call(`/s/${slug}`, "HEAD"); check(r.status === 302 && r.headers.get("location") === record.destination && (await row(slug)).clicks === 1, "old /s/ links still resolve without changing codes");
  await Promise.all(Array.from({ length: 6 }, () => call(`/${slug}`))); check((await row(slug)).clicks === 7, "concurrent visits increment atomically");
  r = await call("/api/links", "POST", { slug, destination: "https://example.org/" }); check(r.status === 409, "duplicate ending is rejected");
  for (const reserved of ["api", "logout", "login"]) { r = await call("/api/links", "POST", {slug:reserved,destination:"https://example.com"}); check(r.status === 409, `rejects reserved ending ${reserved}`); }
  r = await call("/logout"); check(r.status===200 && (await r.text()).includes("Sign out?"), "logout page is not intercepted by short links");
  for (const destination of ["javascript:alert(1)", "data:text/html,hello", "file:///C:/test", "https://user:password@example.com", base + "/s/test"]) {
    r = await call("/api/links", "POST", { destination }); check(r.status === 400, `rejects unsafe destination ${destination.split(":")[0]}`);
  }
  r = await call("/api/links", "POST", { destination: "https://example.com", slug: "Bad Ending" }); check(r.status === 400, "rejects invalid custom endings");
  r = await call("/api/links", "POST", { destination: "https://example.com", title: "x".repeat(101) }); check(r.status === 400, "enforces title limit");
  r = await call("/api/links", "POST", { destination: "https://example.com" }, { Origin: "https://untrusted.example" }); check(r.status === 403, "blocks cross-origin writes");
  r = await call("/api/links", "GET", undefined, { Origin: "https://untrusted.example" }); check(r.status === 403, "blocks cross-origin reads");
  r = await call("/api/links", "POST", { destination: "https://example.com" }, { "X-Shortly-Request": "" }); check(r.status === 403, `requires explicit write header (${r.status}: ${await r.text()})`);
  r = await fetch(base + "/api/links", { method: "POST", headers: { "Content-Type": "application/json", "X-Shortly-Request": "1", Cookie: cookie }, body: "{" }); check(r.status === 400, "malformed JSON has a friendly error");
  r = await call("/api/links", "POST", { destination: "https://example.com", title: "x".repeat(10000) }); check(r.status === 413, "oversized requests are rejected");
  r = await call(`/api/links/${slug}`, "PATCH", { destination: "https://example.org/updated", title: "Updated" }); check(r.status === 200, "edits destination and title");
  r = await call(`/${slug}`); check(r.headers.get("location") === "https://example.org/updated", "same short address uses edited destination");
  await call(`/api/links/${slug}`, "PATCH", { active: false }); r = await call(`/${slug}`); check(r.status === 404 && (await row(slug)).clicks === 8, "paused link stops redirecting and counting");
  r = await call(`/s/${slug}`); check(r.status===404, "pausing also disables the old /s/ address");
  await call(`/api/links/${slug}`, "PATCH", { active: true }); r = await call(`/${slug}`); check(r.status === 302, "resumed link redirects again");
  r = await call("/api/links", "POST", { destination: "https://example.com/auto" }); const auto = (await r.json()).link; cleanup.add(auto.slug); check(r.status === 201 && /^[a-z0-9]{4}$/.test(auto.slug), "generates a four-character ending when omitted");
  r = await fetch(base + "/" + auto.slug, {redirect:"manual"}); check(r.status===302 && r.headers.get("location")==="https://example.com/auto", "four-character root links work without signing in"); await r.arrayBuffer();
  r = await call(`/api/links/${slug}`, "DELETE"); check(r.status === 200 && !(await row(slug)), "deletes a saved link"); cleanup.delete(slug);
  r = await call(`/${slug}`); check(r.status === 404 && (await r.text()).includes("This link is unavailable"), "deleted link shows a helpful missing page");
  r = await call(`/api/links/${slug}`, "PATCH", { title: "Missing" }); check(r.status === 404, "editing a missing link returns 404");
  console.log(`\n${checks} checks passed. Test records are removed below.`);
} finally { for (const item of cleanup) await call(`/api/links/${item}`, "DELETE"); }
