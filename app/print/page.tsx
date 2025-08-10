'use client';

import { useEffect, useMemo, useState } from 'react';

type Card = { code: string; name: string; qty: number; src: string };

export default function PrintPage() {
  const [cards, setCards] = useState<Card[]>([]);

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

  // 基本エネルギー(E_KIHON) は印刷表示では除外
  const cardsNoEnergy = useMemo(
    () => cards.filter(c => !(c.src || '').includes('E_KIHON')),
    [cards]
  );

  const urls = useMemo(() => {
    const u: string[] = [];
    for (const c of cardsNoEnergy) for (let i=0; i<c.qty; i++) u.push(c.src);
    return u;
  }, [cardsNoEnergy]);

  return (
    <main className="p-4 print:p-0">
      <div className="no-print mb-4 flex items-center gap-3">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-2xl bg-blue-600 text-white shadow">印刷</button>
        <button onClick={() => window.close()} className="px-4 py-2 rounded-2xl bg-gray-500 text-white shadow">閉じる</button>
      </div>

      <div className="grid grid-cols-3 gap-0 print:gap-0">
        {urls.map((src, i) => (
          <div key={`${src}:${i}`} className="w-full">
            <img src={src} alt="" className="block w-full h-auto rounded-none shadow-none" />
          </div>
        ))}
      </div>
    </main>
  );
}