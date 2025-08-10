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

    // 画像表示へ
    try {
      const [imgBtn] = await page.$x("//*[contains(text(),'画像表示')]");
      if (imgBtn) {
        await imgBtn.click();
        await page.waitForNetworkIdle({ idleTime: 700, timeout: 10_000 }).catch(() => {});
      }
    } catch {}

    await page.waitForSelector("img[src*='card_images']", { timeout: 12_000 }).catch(() => {});

    // 画像タイルから枚数バッジを推定して複製数を決める
    const items: { src: string; qty: number }[] = await page.evaluate(() => {
      const abs = (u: string) => { try { return new URL(u, location.href).href; } catch { return u; } };
      const list: { src: string; qty: number }[] = [];
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[src*='card_images']"));
      for (const img of imgs) {
        const src = abs(img.getAttribute('src') || (img as any).src || '');
        const tile = img.closest('li, .list, .card, .deck, .item, .thumb, .image, .img, .inner, .box') || img.parentElement;
        let qty = 1;
        if (tile) {
          const texts: string[] = [];
          tile.querySelectorAll<HTMLElement>('*').forEach(el => {
            const t = (el.innerText || '').trim();
            if (t) texts.push(t);
          });
          const candidates: number[] = [];
          for (const t of texts) {
            const m1 = t.match(/[×x]\s*([0-9]{1,2})/i);
            if (m1) { candidates.push(parseInt(m1[1], 10)); continue; }
            const m2 = t.match(/([0-9]{1,2})\s*枚/);
            if (m2) { candidates.push(parseInt(m2[1], 10)); continue; }
            const m3 = t.match(/^[0-9]{1,2}$/);
            if (m3) { candidates.push(parseInt(m3[0], 10)); }
          }
          if (candidates.length) {
            const max = Math.max(...candidates);
            if (max >= 2) qty = max;
          }
        }
        list.push({ src, qty });
      }
      // 同じsrcが複数ある場合は最大qtyを採用
      const map = new Map<string, number>();
      for (const it of list) {
        const prev = map.get(it.src) || 0;
        if (it.qty > prev) map.set(it.src, it.qty);
      }
      return Array.from(map.entries()).map(([src, qty]) => ({ src, qty }));
    });

    let images: string[] = [];
    for (const it of items) {
      const n = Math.max(1, Math.min(60, Math.floor(it.qty || 1)));
      for (let i = 0; i < n; i++) images.push(it.src);
    }
    if (images.length === 0) {
      // フォールバック：従来の一意リスト
      images = await page.$$eval('img', (nodes) => {
        const abs = (u: string) => { try { return new URL(u, location.href).href; } catch { return u; } };
        const urls = Array.from(nodes)
          .map(n => (n as HTMLImageElement).src || (n as HTMLImageElement).getAttribute('src') || '')
          .map(abs)
          .filter(u => /\.jpg(\?.*)?$/i.test(u))
          .filter(u => u.includes('/card_images/'));
        return Array.from(new Set(urls));
      });
    }

    await page.close();
    await browser.close().catch(() => {});
    return NextResponse.json({ deckId, source, count: images.length, images }, { status: 200 });
  } catch (err: any) {
    try { await browser?.close(); } catch {}
    return NextResponse.json({ error: String(err), at: 'browser' }, { status: 500 });
  }
}
