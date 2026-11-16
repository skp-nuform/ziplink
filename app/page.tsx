import { headers } from 'next/headers';
import Dashboard from '@/components/shortly-dashboard';
import Login from '@/components/login';
import { ownerAccess, configured } from '@/lib/authorization';
import { localMode } from '@/lib/database';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const publicOrigin = process.env.VERCEL && process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined;
  if (ownerAccess(await headers())) return <Dashboard local={localMode()} publicOrigin={publicOrigin}/>;
  return <div className="signin-shell"><div className="signin-card"><a className="brand" href="/">shortly<span className="brand-dot">.</span></a><div className="eyebrow">A LITTLE LINK GOES A LONG WAY.</div><h1>Small links.<br/>Ready for the world.</h1><p>This is a personal link workspace. Shared short links open directly — no account needed.</p>{configured() ? <Login/> : <div className="signin-note"><strong>Workspace setup is in progress.</strong><p>The owner needs to finish configuring this workspace before creating links.</p></div>}<p className="signin-privacy">Only the owner can manage links. Visits count toward aggregate click totals; this app stores no visitor device profiles.</p></div></div>;
}
