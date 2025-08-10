import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';

function parseDeckId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const q = u.searchParams.get('deckID');
    if (q) return q;
    const m = u.pathname.match(/\/deckID\/([^/]+)/);
    if (m) return m[1];
  } catch {}
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deck = searchParams.get('deck')?.trim();
  if (!deck) return NextResponse.json({ error: 'Missing ?deck=' }, { status: 400 });

  const deckId = parseDeckId(deck);
  if (!deckId) return NextResponse.json({ error: 'Could not parse deck ID' }, { status: 400 });

  const resultUrl = `https://www.pokemon-card.com/deck/result.html/deckID/${encodeURIComponent(deckId)}/`;
  const confirmUrl = `https://www.pokemon-card.com/deck/confirm.html/deckID/${encodeURIComponent(deckId)}/`;

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

    async function gotoEither(url: string, fallback: string) {
      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
      } catch {
        await page.goto(fallback, { waitUntil: 'networkidle0', timeout: 30_000 });
      }
    }

    await gotoEither(resultUrl, confirmUrl);

    // 1) list view: code -> {name, qty}
    const listData: Array<{code: string, name: string, qty: number}> = await page.evaluate(() => {
      const pad6 = (n: string) => (n || '').padStart(6, '0');
      const codeFromId = (id: string | null): string | null => {
        if (!id) return null;                       // id="cardName_44603"
        const m = id.match(/cardName_(\d{1,6})/);
        return m ? pad6(m[1]) : null;               // → "044603"
      };
      const codeFromOnclick = (onclick: string | null): string | null => {
        if (!onclick) return null;                  // onclick="PCGDECK.cardDetailViewCall('44603')"
        const m = onclick.match(/cardDetailViewCall\('(\d{1,6})'\)/);
        return m ? pad6(m[1]) : null;               // → "044603"
      };

      const rows = Array.from((document.querySelector('#cardListView') || document.body).querySelectorAll('tr'));
      const result: Array<{code:string, name:string, qty:number}> = [];
      for (const tr of rows) {
        const a = tr.querySelector('a[id^="cardName_"], a[onclick*="cardDetailViewCall"]') as HTMLAnchorElement | null;
        if (!a) continue;
        const code = codeFromId(a.getAttribute('id')) || codeFromOnclick(a.getAttribute('onclick'));
        if (!code) continue;
        let name = (a.textContent || '').split('\n')[0].trim();
        if (!name) name = a.getAttribute('aria-label') || '';

        const qtyCell = tr.querySelector('td.nowrap, td:last-child');
        let qty = 0;
        if (qtyCell) {
          const txt = (qtyCell.textContent || '').trim();
          const m = txt.match(/(\d{1,2})\s*枚/);
          if (m) qty = parseInt(m[1], 10);
        }
        if (qty > 0) result.push({ code, name, qty });
      }
      return result;
    });

    // 2) image view: code -> src (E_KIHON も含める)
    try {
      const [imgBtn] = await page.$x("//*[contains(text(),'画像表示')]");
      if (imgBtn) {
        await imgBtn.click();
        await page.waitForNetworkIdle({ idleTime: 700, timeout: 10_000 }).catch(() => {});
      }
    } catch {}

    await page.waitForSelector("img[src*='card_images']", { timeout: 12_000 }).catch(() => {});

    const codeToSrc: Record<string, string> = await page.evaluate(() => {
      const abs = (u: string) => { try { return new URL(u, location.href).href; } catch { return u; } };
      const codeFromSrc = (src: string): string | null => {
        const m = src.match(/\/(\d{6})_[A-Z_]+\.jpg/i);
        return m ? m[1] : null;
      };
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[src*='card_images']"));
      const map = new Map<string, string>();
      for (const img of imgs) {
        const s = abs(img.getAttribute('src') || (img as any).src || '');
        const code = codeFromSrc(s);
        if (!code) continue;
        if (!map.has(code)) map.set(code, s);
      }
      const out: Record<string, string> = {};
      for (const [k, v] of map.entries()) out[k] = v;
      return out;
    });

    await page.close();
    await browser.close().catch(() => {});

    // join & de-duplicate
    const cards = listData.map(row => ({ ...row, src: codeToSrc[row.code] })).filter(c => !!c.src);

    return NextResponse.json({ cards }, { status: 200 });
  } catch (err: any) {
    try { await browser?.close(); } catch {}
    return NextResponse.json({ error: String(err), at: 'browser' }, { status: 500 });
  }
}