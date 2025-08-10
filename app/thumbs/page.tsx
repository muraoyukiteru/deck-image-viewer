
'use client';

import { useEffect, useState } from 'react';

type Card = { code: string; name: string; qty: number; src: string };

export default function ThumbsPage() {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('proxy-thumbs-v1');
      if (raw) {
        const data = JSON.parse(raw);
        const list: Card[] = (data?.cards || []).filter((c: any) => c && c.src && c.qty > 0);
        setCards(list);
      }
    } catch {}
  }, []);

  return (
    <main className="p-4 print:p-0">
      <div className="no-print mb-4 flex items-center gap-3">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-2xl bg-blue-600 text-white shadow">印刷</button>
        <button onClick={() => window.close()} className="px-4 py-2 rounded-2xl bg-gray-500 text-white shadow">閉じる</button>
      </div>

      <div className="grid grid-cols-9 gap-0 print:grid-cols-9">
        {cards.map((c) => (
          <div key={c.code} className="relative">
            <img src={c.src} alt={c.name} className="block w-full h-auto rounded-none shadow-none" />
            <div className="badge">{c.qty}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
