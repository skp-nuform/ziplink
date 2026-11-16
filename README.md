# Shortly / Ziplink

A public link shortener with a private owner dashboard. Built with Next.js for Vercel.

Create random or custom short links, change destinations, pause/resume/delete, see aggregate click counts, download QR codes, search, sort and export JSON. Visitors can create and share links without an account or password. The owner signs in at /login to list, edit, pause, delete and export links. Guest visitors cannot list or manage any saved links, including their own; they should copy their link before leaving.

## Deploy to Vercel

1. Import the GitHub repository. Framework: Next.js; root directory: repository root. Node: 24.x. Build: npm run build. Do not override output directory.
2. Under Storage, add a **free Neon Postgres** database and connect it to this project. The integration supplies DATABASE_URL. Do not enable paid upgrades.
3. In Environment Variables, set SHORTLY_ADMIN_PASSWORD to a unique password of 24–256 characters. Keep it in a password manager. Do not put it in source control or a NEXT_PUBLIC_ variable. Set it in Production; use separate credentials/databases for Preview.
4. Redeploy after setting the variables. Tables are created automatically on first use. Open the assigned vercel.app address to shorten links immediately. Use /login for owner management. Short links use /your-ending and are public. Automatically generated endings are four characters. Previously shared /s/ links keep working, including old QR codes. Existing codes are not renamed. App paths such as api and logout cannot be used as new custom endings.

Owner management fails closed if the password is missing or too short; public creation remains available. No one can claim the workspace. Changing the password invalidates all existing sessions. Sessions expire in seven days. Login attempts are limited in the database; raw visitor IPs are not saved. Public creation is limited to 10 attempts per visitor IP per ten-minute window, plus 30 attempts per minute across the service. These counters are persisted and atomic; expired hashed visitor buckets are removed during later requests.

## Local development

Requires Node.js 24. Copy .env.example to .env.local, set a development password and leave SHORTLY_LOCAL=1. Run npm ci then npm run dev -- --port 5174. Local links are stored in .data/shortly.sqlite. Local mode is ignored on Vercel. Local and hosted data are separate; the previous prototype's local database has not been modified.

## Checks

npm test
npm run build

With the local server running, set SHORTLY_TEST_URL and SHORTLY_ADMIN_PASSWORD to match the test workspace and run npm run test:integration. This creates and deletes only its own test links. Do not run destructive test scenarios against real links.

## Scope

Single owner, up to 5,000 links, basic aggregate counts (bots/repeat visits also count), no malware scanning or public registration. Free hosting/database limits apply. Keep JSON exports as backups. Vercel Hobby is intended for personal non-commercial use; review the provider's terms before commercial use. Password resets are done by updating the server environment variable and redeploying.
