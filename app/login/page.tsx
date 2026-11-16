import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Login from '@/components/login';
import { ownerAccess, configured } from '@/lib/authorization';

export const dynamic = 'force-dynamic';
export default async function OwnerLogin() {
  if (ownerAccess(await headers())) redirect('/#links');
  return <div className="signin-shell"><div className="signin-card"><a className="brand" href="/">shortly<span className="brand-dot">.</span></a><a className="back-to-shorten" href="/">← Shorten a link without signing in</a><div className="eyebrow">OWNER ACCESS</div><h1>Welcome back.</h1><p>Sign in to manage links. Everyone can shorten a link without signing in.</p>{configured() ? <Login/> : <div className="signin-note"><strong>Workspace setup is in progress.</strong><p>The owner needs to finish configuring this workspace before creating links.</p></div>}<p className="signin-privacy">Only the owner can view, edit, or delete saved links.</p></div></div>;
}
