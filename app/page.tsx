import { headers } from 'next/headers';
import Dashboard from '@/components/shortly-dashboard';
import { ownerAccess } from '@/lib/authorization';
import { localMode } from '@/lib/database';
export const dynamic = 'force-dynamic';
export default async function Home() {
  return <Dashboard local={localMode()} owner={ownerAccess(await headers())}/>;
}
