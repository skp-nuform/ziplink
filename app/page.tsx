import { headers } from 'next/headers';
import Dashboard from '@/components/shortly-dashboard';
import Login from '@/components/login';
import { ownerAccess, configured } from '@/lib/authorization';
import { localMode } from '@/lib/database';
export const dynamic = 'force-dynamic';
export default async function Home() {
  if (ownerAccess(await headers())) return <Dashboard local={localMode()}/>;
  return <div className="signin-shell"><div className="signin-card"><a className="brand" href="/">shortly<span className="brand-dot">.</span></a><div className="eyebrow">YOUR PERSONAL LINK WORKSPACE</div><h1>Welcome back.</h1><p>Sign in to shorten, share, and manage your links.</p>{configured() ? <Login/> : <div className="signin-note"><strong>Workspace setup is in progress.</strong><p>The owner needs to finish configuring this workspace before creating links.</p></div>}<p className="signin-privacy">Shared links open for everyone. Only you can manage them.</p></div></div>;
}
