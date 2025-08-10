import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';
import { parseDeckId } from '@/lib/normalizeDeck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds (Vercel serverless cap)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deck = searchParams.get('deck')?.trim();
  if (!deck) return NextResponse.json({ error: 'Missing ?deck=' }, { status: 400 });

  const deckId = parseDeckId(deck);
  if (!deckId) return NextResponse.json({ error: 'Could not parse deck ID' }, { status: 400 });

  const source = `https://www.pokemon-card.com/deck/confirm.html/deckID/${encodeURIComponent(deckId)}/`;

  let browser: any;
  try {
    const isLambda = !!(process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.VERCEL);
    if (isLambda) {
      const execPath = await chromium.executablePath();
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: execPath || undefined,
        headless: chromium.headless,
      });
    } else {
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({ headless: true });
    }

    const page = await browser.newPage();
    await page.goto(source, { waitUntil: 'networkidle0', timeout: 30_000 });

    try {
      const [btn] = await page.$x("//*[contains(text(),'画像表示')]");
      if (btn) {
        await btn.click();
        await page.waitForNetworkIdle({ idleTime: 700, timeout: 10_000 }).catch(() => {});
      }
    } catch {}

    await page.waitForSelector("img[src*='card_images']", { timeout: 12_000 }).catch(() => {});

    let images: string[] = await page.$$eval('img', (nodes) => {
      const abs = (u: string) => { try { return new URL(u, location.href).href; } catch { return u; } };
      const urls = Array.from(nodes)
        .map(n => (n as HTMLImageElement).src || (n as HTMLImageElement).getAttribute('src') || '')
        .map(abs)
        .filter(u => /\.jpg(\?.*)?$/i.test(u))
        .filter(u => u.includes('/card_images/'));
      return Array.from(new Set(urls));
    });

    if (images.length === 0) {
      images = await page.$$eval("img[data-src*='card_images']", (nodes) => {
        const abs = (u: string) => { try { return new URL(u, location.href).href; } catch { return u; } };
        const urls = Array.from(nodes)
          .map(n => (n as HTMLElement).getAttribute('data-src') || '')
          .map(abs)
          .filter(u => /\.jpg(\?.*)?$/i.test(u));
        return Array.from(new Set(urls));
      }).catch(() => []);
    }

    await page.close();
    await browser.close().catch(() => {});

    return NextResponse.json({ deckId, source, count: images.length, images }, { status: 200 });
  } catch (err: any) {
    try { await browser?.close(); } catch {}
    return NextResponse.json({ error: String(err), at: 'browser' }, { status: 500 });
  }
}
