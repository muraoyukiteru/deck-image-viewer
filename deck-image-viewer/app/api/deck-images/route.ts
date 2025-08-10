
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

    // 1) Collect quantities in list view
    type CountEntry = [string, number];
    let countEntries: CountEntry[] = [];
    try {
      const [listBtn] = await page.$x("//*[contains(text(),'リスト表示')]");
      if (listBtn) {
        await listBtn.click();
        await page.waitForNetworkIdle({ idleTime: 700, timeout: 10_000 }).catch(() => {});
      }
      await page.waitForSelector("a[href*='/card/'], a[href*='card-search']", { timeout: 8_000 }).catch(() => {});

      countEntries = await page.evaluate(() => {
        const map = new Map<string, number>();
        const normalize = (href: string) => {
          try { const u = new URL(href, location.href); return u.pathname + u.search; } catch { return href; }
        };
        const rows: Element[] = Array.from(document.querySelectorAll('li, tr, .list, .selected, .deck, .card, .decklist, .deck_list'));
        for (const row of rows) {
          const a = row.querySelector("a[href*='/card/'], a[href*='card-search']") as HTMLAnchorElement | null;
          if (!a) continue;
          const key = normalize(a.getAttribute('href') || '');
          if (!key) continue;

          // gather texts in row to find patterns like ×2 or 2枚
          const texts: string[] = [];
          row.querySelectorAll('*').forEach((el) => {
            const t = (el as HTMLElement).innerText?.trim();
            if (t) texts.push(t);
          });
          let qty = 0;
          for (const t of texts) {
            let m = t.match(/×\s*(\d{1,2})/);
            if (!m) m = t.match(/(\d{1,2})\s*枚/);
            if (m) { qty = Math.max(qty, parseInt(m[1], 10)); }
          }
          if (qty === 0) {
            const numEl = row.querySelector("[class*='num'],[class*='count'],[class*='qty']") as HTMLElement | null;
            if (numEl) {
              const m = (numEl.innerText || '').trim().match(/\d{1,2}/);
              if (m) qty = parseInt(m[0], 10);
            }
          }
          if (qty > 0) map.set(key, qty);
        }
        return Array.from(map.entries());
      });
    } catch {}

    const counts: Record<string, number> = {};
    for (const [k, v] of countEntries) counts[k] = v;

    // 2) Switch to image view and collect images + href
    try {
      const [imgBtn] = await page.$x("//*[contains(text(),'画像表示')]");
      if (imgBtn) {
        await imgBtn.click();
        await page.waitForNetworkIdle({ idleTime: 700, timeout: 10_000 }).catch(() => {});
      }
    } catch {}

    await page.waitForSelector("img[src*='card_images']", { timeout: 12_000 }).catch(() => {});

    const items: { src: string; href: string }[] = await page.evaluate(() => {
      const abs = (u: string) => { try { return new URL(u, location.href).href; } catch { return u; } };
      const list: { src: string; href: string }[] = [];
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[src*='card_images']"));
      for (const img of imgs) {
        const src = abs(img.getAttribute('src') || (img as any).src || '');
        const a = img.closest('a') as HTMLAnchorElement | null;
        let href = '';
        if (a && a.getAttribute('href')) {
          try { const u = new URL(a.getAttribute('href')!, location.href); href = u.pathname + u.search; } catch { href = a.getAttribute('href')!; }
        }
        list.push({ src, href });
      }
      const seen = new Set<string>();
      const uniq: { src: string; href: string }[] = [];
      for (const it of list) {
        const key = it.href || it.src;
        if (seen.has(key)) continue;
        seen.add(key);
        uniq.push(it);
      }
      return uniq;
    });

    // 3) Expand images according to counts
    let expanded: string[] = [];
    for (const it of items) {
      const qty = counts[it.href] || 1;
      for (let i = 0; i < qty; i++) expanded.push(it.src);
    }
    if (expanded.length === 0) expanded = items.map((i) => i.src);

    await page.close();
    await browser.close().catch(() => {});

    return NextResponse.json({ deckId, source, count: expanded.length, images: expanded, counts }, { status: 200 });
  } catch (err: any) {
    try { await browser?.close(); } catch {}
    return NextResponse.json({ error: String(err), at: 'browser' }, { status: 500 });
  }
}
