
'use client';

import { useEffect, useMemo, useState } from 'react';

type Card = { code: string; name: string; qty: number; src: string };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const DEFAULT_K = 1.028; // 実寸補正の既定値（約 +2.8%）

export default function PrintPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [k, setK] = useState<number>(DEFAULT_K);
  // ★ デフォルトOFF、毎回OFFで開始（永続化しない）
  const [includeEnergy, setIncludeEnergy] = useState<boolean>(false);

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

  // k（倍率）のみ永続化を維持
  useEffect(() => {
    try {
      const saved = parseFloat(localStorage.getItem('print-k') || '');
      if (Number.isFinite(saved) && saved > 0.9 && saved < 1.1) setK(saved);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty('--print-k', String(k));
    try { localStorage.setItem('print-k', String(k)); } catch {}
  }, [k]);

  const filtered = useMemo(
    () => includeEnergy ? cards : cards.filter(c => !(c.src || '').includes('E_KIHON')),
    [cards, includeEnergy]
  );

  const urls = useMemo(() => {
    const u: string[] = [];
    for (const c of filtered) for (let i=0; i<c.qty; i++) u.push(c.src);
    return u;
  }, [filtered]);

  const pages = useMemo(() => chunk(urls, 9), [urls]);

  return (
    <main className="a4-print">
      <style jsx global>{`
        :root { --print-k: ${DEFAULT_K}; --mk-len: 5mm; --mk-thick: 0.2mm; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          .no-print { display: none !important; }
        }
        .a4-print { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .a4-page {
          width: 210mm;
          height: 297mm;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          break-after: page;
          page-break-after: always;
        }
        .a4-page:last-of-type {
          break-after: auto !important;
          page-break-after: auto !important;
        }
        .a4-grid {
          width: calc(3 * 63mm * var(--print-k));
          height: calc(3 * 88mm * var(--print-k));
          display: grid;
          grid-template-columns: repeat(3, calc(63mm * var(--print-k)));
          grid-template-rows: repeat(3, calc(88mm * var(--print-k)));
          gap: 0;
        }
        .slot {
          position: relative;
          width: calc(63mm * var(--print-k));
          height: calc(88mm * var(--print-k));
          overflow: visible;
        }
        .slot img {
          display: block;
          width: calc(63mm * var(--print-k));
          height: calc(88mm * var(--print-k));
          object-fit: contain;
          background: #fff;
        }
        .mk { position: absolute; pointer-events: none; }
        .mk.v   { width: 0; height: var(--mk-len); border-left: var(--mk-thick) solid #000; }
        .mk.h   { width: var(--mk-len); height: 0; border-top: var(--mk-thick) solid #000; }
        .mk.top    { top: calc(-1 * var(--mk-len)); }
        .mk.bottom { top: 100%; }
        .mk.left  { left: calc(-1 * var(--mk-len)); }
        .mk.right { left: 100%; }
        .mk.tl { left: 0; }
        .mk.tr { left: 100%; transform: translateX(-1px); }
        .mk.bl { left: 0; }
        .mk.br { left: 100%; transform: translateX(-1px); }
        .mk.lt { top: 0; }
        .mk.lb { top: 100%; transform: translateY(-1px); }
        .mk.rt { top: 0; }
        .mk.rb { top: 100%; transform: translateY(-1px); }
      `}</style>

      <div className="no-print" style={{ padding: '12px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => window.print()} className="px-4 py-2 rounded-2xl bg-blue-600 text-white shadow">印刷</button>
        <button onClick={() => window.close()} className="px-4 py-2 rounded-2xl bg-gray-500 text-white shadow">閉じる</button>

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

        <label className="text-sm text-neutral-700" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={includeEnergy}
            onChange={e => setIncludeEnergy(e.target.checked)}
          />
          基本エネルギーも印刷する
        </label>

        <span className="text-sm text-neutral-600">
          対象: <b>{urls.length}</b> 枚（ページ数: <b>{pages.length}</b>）
        </span>
        {!includeEnergy && (
          <span className="text-xs text-neutral-500">
            ※ 基本エネルギーは現在印刷対象外です
          </span>
        )}
      </div>

      {pages.map((urls9, pi) => (
        <section className="a4-page" key={pi}>
          <div className="a4-grid">
            {urls9.map((src, i) => {
              const row = Math.floor(i / 3);
              const col = i % 3;
              const isTop = row === 0;
              const isBottom = row === 2;
              const isLeft = col === 0;
              const isRight = col === 2;
              return (
                <div className="slot" key={`${src}:${i}`}>
                  <img src={src} alt={`card-${i}`} />
                  {/* 上辺のガイド（外側へ） */}
                  {isTop && (<>
                    <span className="mk v top tl" />
                    <span className="mk v top tr" />
                  </>)}
                  {/* 下辺のガイド（外側へ） */}
                  {isBottom && (<>
                    <span className="mk v bottom bl" />
                    <span className="mk v bottom br" />
                  </>)}
                  {/* 左辺のガイド（外側へ） */}
                  {isLeft && (<>
                    <span className="mk h left lt" />
                    <span className="mk h left lb" />
                  </>)}
                  {/* 右辺のガイド（外側へ） */}
                  {isRight && (<>
                    <span className="mk h right rt" />
                    <span className="mk h right rb" />
                  </>)}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
