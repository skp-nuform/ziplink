import { redirectLink, type Context } from '@/lib/redirect-link';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: Context) { return redirectLink(request, context, true); }
export async function HEAD(request: Request, context: Context) { return redirectLink(request, context, false); }
