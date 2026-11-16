import { cookieName } from '@/lib/authorization';
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return new Response('Not allowed',{status:403});
  return new Response(null,{status:303,headers:{Location:'/', 'Cache-Control':'no-store','Set-Cookie':cookieName+'=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(process.env.VERCEL ? '; Secure' : '')}});
}
