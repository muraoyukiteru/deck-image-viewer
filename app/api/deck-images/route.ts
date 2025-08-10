import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';
import { parseDeckId } from '@/lib/normalizeDeck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deck = searchParams.get('deck')?.trim();
  const debug = searchParams.get('debug') === '1';
  if (!deck) return NextResponse.json({ error: 'Missing ?deck=' }, { status: 400 });

  const deckId = parseDeckId(deck);
  if (!deckId) return NextResponse.json({ error: 'Could not parse deck ID' }, { status: 400 });

  const resultUrl = `https://www.pokemon-card.com/deck/result.html/deckID/${encodeURIComponent(deckId)}/`;
  const confirmUrl = `https://www.pokemon-card.com/deck/confirm.html/deckID/${encodeURIComponent(deckId)}/`;

  let browser: any;
  let usedUrl = resultUrl;
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

    async function gotoEither(url: string, fallback: string) {
      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
        usedUrl = url;
      } catch {
        await page.goto(fallback, { waitUntil: 'networkidle0', timeout: 30_000 });
        usedUrl = fallback;
      }
    }

    await gotoEither(resultUrl, confirmUrl);

    // 1) read counts from list table (#cardListView)
    const countByCode: Record<string, number> = await page.evaluate(() => {
      const pad6 = (n: string) => (n || '').padStart(6, '0');
      const codeFromId = (id: string | null): string | null => {
        if (!id) return null;
        const m = id.match(/cardName_(\d{1,6})/);
        return m ? pad6(m[1]) : null;
      };
      const codeFromOnclick = (onclick: string | null): string | null => {
        if (!onclick) return null;
        const m = onclick.match(/cardDetailViewCall\('(\d{1,6})'\)/);
        return m ? pad6(m[1]) : null;
      };

      const map = new Map<string, number>();
      const root = document.querySelector('#cardListView') || document.body;
      const rows = Array.from(root.querySelectorAll('tr'));
      for (const tr of rows) {
        const a = tr.querySelector('a[id^="cardName_"], a[onclick*="cardDetailViewCall"]') as HTMLAnchorElement | null;
        if (!a) continue;
        const code = codeFromId(a.getAttribute('id')) || codeFromOnclick(a.getAttribute('onclick'));
        if (!code) continue;
        const qtyCell = tr.querySelector('td.nowrap, td:last-child');
        let qty = 0;
        if (qtyCell) {
          const txt = (qtyCell.textContent || '').trim();
          const m = txt.match(/(\d{1,2})\s*枚/);
          if (m) qty = parseInt(m[1], 10);
        }
        if (qty > 0) map.set(code, qty);
      }
      const out: Record<string, number> = {};
      for (const [k, v] of map.entries()) out[k] = v;
      return out;
    });

    let counts = countByCode;
    if (Object.keys(counts).length === 0) {
      try {
        const [listBtn] = await page.$x(
          "//*[contains(text(),'リスト表示')] | //*[contains(text(),'リスト')] | //button[contains(@aria-label,'リスト')] | //a[contains(@href,'list')]"
        );
        if (listBtn) {
          await listBtn.click();
          await page.waitForNetworkIdle({ idleTime: 700, timeout: 10_000 }).catch(() => {});
        }
      } catch {}
      counts = await page.evaluate(() => {
        const pad6 = (n: string) => (n || '').padStart(6, '0');
        const codeFromId = (id: string | null): string | null => {
          if (!id) return null;
          const m = id.match(/cardName_(\d{1,6})/);
          return m ? pad6(m[1]) : null;
        };
        const codeFromOnclick = (onclick: string | null): string | null => {
          if (!onclick) return null;
          const m = onclick.match(/cardDetailViewCall\('(\d{1,6})'\)/);
          return m ? pad6(m[1]) : null;
        };
        const map = new Map<string, number>();
        const root = document.querySelector('#cardListView') || document.body;
        const rows = Array.from(root.querySelectorAll('tr'));
        for (const tr of rows) {
          const a = tr.querySelector('a[id^="cardName_"], a[onclick*="cardDetailViewCall"]') as HTMLAnchorElement | null;
          if (!a) continue;
          const code = codeFromId(a.getAttribute('id')) || codeFromOnclick(a.getAttribute('onclick'));
          if (!code) continue;
          const qtyCell = tr.querySelector('td.nowrap, td:last-child');
          let qty = 0;
          if (qtyCell) {
            const txt = (qtyCell.textContent || '').trim();
            const m = txt.match(/(\d{1,2})\s*枚/);
            if (m) qty = parseInt(m[1], 10);
          }
          if (qty > 0) map.set(code, qty);
        }
        const out: Record<string, number> = {};
        for (const [k, v] of map.entries()) out[k] = v;
        return out;
      });
    }

    // 2) collect image src + code
    await page.waitForSelector("img[src*='card_images']", { timeout: 12_000 }).catch(() => {});
    const items: { code: string | null; src: string }[] = await page.evaluate(() => {
      const abs = (u: string) => { try { return new URL(u, location.href).href; } catch { return u; } };
      const codeFromSrc = (src: string): string | null => {
        const m = src.match(/\/(\d{6})_[A-Z_]+\.jpg/i);
        return m ? m[1] : null;
      };
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[src*='card_images']"));
      const list: { code: string | null; src: string }[] = [];
      for (const img of imgs) {
        const s = abs(img.getAttribute('src') || (img as any).src || '');
        list.push({ code: codeFromSrc(s), src: s });
      }
      const seen = new Set<string>();
      const uniq: { code: string | null; src: string }[] = [];
      for (const it of list) {
        if (seen.has(it.src)) continue;
        seen.add(it.src);
        uniq.push(it);
      }
      return uniq;
    });

    // 3) expand by counts
    let images: string[] = [];
    for (const it of items) {
      const qty = Math.max(1, Math.min(60, counts[it.code || ''] || 1));
      for (let i = 0; i < qty; i++) images.push(it.src);
    }

    // 4) filter out E_KIHON cards
    images = images.filter(src => !src.includes('E_KIHON'));

    await page.close();
    await browser.close().catch(() => {});

    if (debug) {
      return NextResponse.json({
        version: 'qty-join-by-element-mai+filter',
        deckId, source: usedUrl,
        countsSample: Object.entries(counts).slice(0, 12),
        itemSample: items.slice(0, 10),
        count: images.length,
        imagesSample: images.slice(0, 10),
      }, { status: 200 });
    }

    return NextResponse.json({ version: 'qty-join-by-element-mai+filter', deckId, source: usedUrl, count: images.length, images }, { status: 200 });
  } catch (err: any) {
    try { await browser?.close(); } catch {}
    return NextResponse.json({ error: String(err), at: 'browser' }, { status: 500 });
  }
}
