import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const u = searchParams.get('u');
  if (!u) return new Response('Missing ?u', { status: 400 });
  try {
    const r = await fetch(u, { cache: 'no-store' });
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': r.headers.get('Content-Type') || 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (e: any) {
    return new Response('fetch failed', { status: 502 });
  }
}