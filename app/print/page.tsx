
'use client';

import { useEffect, useMemo, useState } from 'react';

type Card = { code: string; name: string; qty: number; src: string };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 既定の補正係数（ユーザー実測: 横63→61.5, 縦88→85.5 から平均的に推定）
const DEFAULT_K = 1.028; // 約2.8%拡大

export default function PrintPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [k, setK] = useState<number>(DEFAULT_K);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('proxy-print-v1');
      if (raw) {
        const data = JSON.parse(raw);
        const list: Card[] = (data?.cards || []).filter((c: any) => c && c.src && c.qty > 0);
        setCards(list);
      }
    } catch {}
  }, []);

  // 保存済みの補正値を読み込み
  useEffect(() => {
    try {
      const saved = parseFloat(localStorage.getItem('print-k') || '');
      if (Number.isFinite(saved) && saved > 0.9 && saved < 1.1) setK(saved);
    } catch {}
  }, []);

  // CSS 変数へ適用
  useEffect(() => {
    document.documentElement.style.setProperty('--print-k', String(k));
    try { localStorage.setItem('print-k', String(k)); } catch {}
  }, [k]);

  // 基本エネルギー(E_KIHON) は印刷表示では除外
  const cardsNoEnergy = useMemo(
    () => cards.filter(c => !(c.src || '').includes('E_KIHON')),
    [cards]
  );

  // 画像URLを数量分展開
  const urls = useMemo(() => {
    const u: string[] = [];
    for (const c of cardsNoEnergy) for (let i=0; i<c.qty; i++) u.push(c.src);
    return u;
  }, [cardsNoEnergy]);

  // A4 1ページに 3x3 = 9 枚
  const pages = useMemo(() => chunk(urls, 9), [urls]);

  return (
    <main className="a4-print">
      {/* 印刷用の固定レイアウトCSS（補正係数 --print-k を掛ける） */}
      <style jsx global>{`
        :root { --print-k: ${DEFAULT_K}; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { width: 210mm; height: 297mm; background: #fff !important; }
          .no-print { display: none !important; }
        }
        .a4-print { background: #fff; }
        .a4-page {
          width: 210mm;
          height: 297mm;
          margin: 0 auto;
          page-break-after: always;
          display: flex;
          align-items: center;    /* 余白を上下に均等配分 */
          justify-content: center;/* 左右中央寄せ */
        }
        .a4-grid {
          width: calc(3 * 63mm * var(--print-k));
          height: calc(3 * 88mm * var(--print-k));
          display: grid;
          grid-template-columns: repeat(3, calc(63mm * var(--print-k)));
          grid-template-rows: repeat(3, calc(88mm * var(--print-k)));
          gap: 0; /* 隙間なし */
        }
        .slot {
          width: calc(63mm * var(--print-k));
          height: calc(88mm * var(--print-k));
          overflow: hidden;
        }
        .slot img {
          display: block;
          width: calc(63mm * var(--print-k));
          height: calc(88mm * var(--print-k));
          object-fit: contain; /* 画像比率を維持（切り抜きしない） */
          background: #fff;
        }
      `}</style>

      <div className="no-print" style={{ padding: '12px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => window.print()} className="px-4 py-2 rounded-2xl bg-blue-600 text-white shadow">印刷</button>
        <button onClick={() => window.close()} className="px-4 py-2 rounded-2xl bg-gray-500 text-white shadow">閉じる</button>

        {/* 補正コントロール */}
        <label className="text-sm text-neutral-700" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          補正（63×88に実測を合わせる倍率）
          <input
            type="number"
            step="0.001"
            min="0.950"
            max="1.080"
            value={k}
            onChange={e => setK(parseFloat(e.target.value || '1') || 1)}
            className="w-24 text-right rounded-md border px-2 py-1"
          />
        </label>
        <span className="text-xs text-neutral-500">例: 1.000（補正なし）, 1.028（+2.8%）</span>
      </div>

      {pages.map((urls9, pi) => (
        <section className="a4-page" key={pi}>
          <div className="a4-grid">
            {urls9.map((src, i) => (
              <div className="slot" key={`${src}:${i}`}>
                <img src={src} alt={`card-${i}`} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
