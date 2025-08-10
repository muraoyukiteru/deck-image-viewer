
'use client';

import { useMemo, useState } from 'react';

type Card = { code: string; name: string; qty: number; src?: string; selected?: boolean };
type ApiResult = { cards: Card[]; error?: string };

function isImageUrl(u: string): boolean {
  try { const url = new URL(u); return (/\.(jpg|jpeg|png|webp)$/i).test(url.pathname); }
  catch { return (/\.(jpg|jpeg|png|webp)(\?.*)?$/i).test(u); }
}
function baseNameFromUrl(u: string): string {
  try { const url = new URL(u); const seg = url.pathname.split('/').filter(Boolean).pop()||''; return decodeURIComponent(seg).replace(/\.(jpg|jpeg|png|webp)$/i,''); }
  catch { const seg = u.split('/').filter(Boolean).pop()||''; return seg.replace(/\.(jpg|jpeg|png|webp).*$/i,''); }
}

export default function Page() {
  const [deck, setDeck] = useState('');
  const [extra, setExtra] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const allSelected = useMemo(() => cards.length>0 && cards.every(c=>c.selected), [cards]);

  async function fetchCardsFrom(value: string) {
    const res = await fetch(`/api/deck-cards?deck=${encodeURIComponent(value)}`, { cache: 'no-store' });
    const data: ApiResult = await res.json();
    if (!res.ok) throw new Error(data?.error || '取得に失敗しました');
    return (data.cards||[]) as Card[];
  }
  async function handleRefresh() {
    setErr(null); setLoading(true);
    try { const main = await fetchCardsFrom(deck); setCards(main.map(c=>({...c, selected:true}))); }
    catch(e:any){ setErr(e.message); } finally { setLoading(false); }
  }
  async function handleAdd() {
    const v = extra.trim(); if(!v) return;
    setErr(null); setLoading(true);
    try {
      if (isImageUrl(v)) {
        const base = baseNameFromUrl(v); const code = `IMG:${base}`;
        setCards(prev => {
          const map = new Map(prev.map(c=>[c.code,{...c}]));
          const ex = map.get(code);
          if (ex) { ex.qty = Math.min(99, ex.qty+1); ex.src ||= v; ex.name ||= base; ex.selected = true; }
          else { map.set(code, { code, name: base||code, qty: 1, src: v, selected: true }); }
          return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name,'ja'));
        });
      } else {
        const add = await fetchCardsFrom(v);
        setCards(prev => {
          const map = new Map(prev.map(c=>[c.code,{...c}]));
          for (const c of add) {
            const ex = map.get(c.code);
            if (ex) { ex.qty = Math.min(99, ex.qty + c.qty); ex.src ||= c.src; ex.selected ??= true; }
            else { map.set(c.code, { ...c, selected: true }); }
          }
          return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name,'ja'));
        });
      }
      setExtra('');
    } catch(e:any){ setErr(e.message); } finally { setLoading(false); }
  }
  function setQty(code: string, v: number) {
    const val = Math.max(0, Math.min(99, Math.floor(Number.isFinite(v)?v:0)));
    setCards(cs=>cs.map(c=>c.code===code?{...c, qty:val}:c));
  }
  function toggle(code: string){ setCards(cs=>cs.map(c=>c.code===code?{...c, selected:!c.selected}:c)); }
  function toggleAll(){ const next=!allSelected; setCards(cs=>cs.map(c=>({...c, selected:next}))); }
  function openPrint(){ const selected = cards.filter(c=>c.selected && c.qty>0 && c.src); localStorage.setItem('proxy-print-v1', JSON.stringify({ deck, cards: selected })); window.open('/print','_blank'); }
  function openThumbs(){ const selected = cards.filter(c=>c.selected && c.qty>0 && c.src); localStorage.setItem('proxy-thumbs-v1', JSON.stringify({ deck, cards: selected })); window.open('/thumbs','_blank'); }

  // 2倍の高さを約96pxとして固定（テキスト行+パディングの想定に基づく）。必要なら後で調整可。
  const rowDouble = 96;

  return (
    <main className="space-y-6">
      <h1 className="text-4xl font-extrabold text-blue-600">プロキシメーカー</h1>
      <div className="flex gap-3 items-center">
        <input value={deck} onChange={e=>setDeck(e.target.value)} placeholder="デッキURL か デッキコード" className="flex-1 px-4 py-2 rounded-2xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"/>
        <button onClick={handleRefresh} disabled={loading} className="btn-blue">{loading?'取得中…':'更新'}</button>
        <button onClick={openPrint} className="px-4 py-2 rounded-2xl bg-blue-600 text-white shadow">印刷表示</button>
        <button onClick={openThumbs} className="px-4 py-2 rounded-2xl bg-blue-500 text-white shadow">デッキ一覧画像を表示</button>
      </div>
      <div className="flex gap-3 items-center">
        <input value={extra} onChange={e=>setExtra(e.target.value)} placeholder="追加カードURL（画像URL または もう1つのデッキURL/コード）" className="flex-1 px-4 py-2 rounded-2xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"/>
        <button onClick={handleAdd} disabled={loading} className="btn-blue">追加</button>
      </div>
      {err && <div className="p-3 rounded-2xl bg-red-50 text-red-700 text-sm">{err}</div>}
      <div className="card">
        <table className="w-full">
          <thead className="table-head">
            <tr>
              <th className="text-left p-4 w-[50%]">カード名 + 画像</th>
              <th className="text-left p-4 w-[25%]">枚数</th>
              <th className="text-left p-4 w-[25%]">選択<br/><button onClick={toggleAll} className="underline text-sm">{allSelected?'全解除':'全選択'}</button></th>
            </tr>
          </thead>
          <tbody>
            {cards.map(c=>(
              <tr key={c.code} className="odd:bg-blue-50/40">
                <td className="p-4">
                  <div className="flex items-center justify-between gap-3" style={{ minHeight: rowDouble }}>
                    <span className="pr-2">{c.name}</span>
                    {c.src && (
                      <img
                        src={c.src}
                        alt={c.name}
                        style={{ height: rowDouble, width: 'auto' }}
                        className="object-contain rounded-md border border-neutral-200"
                      />
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <input type="number" min={0} max={99} value={c.qty} onChange={e=>setQty(c.code, Number(e.target.value))} className="w-24 px-2 py-1 rounded-lg border border-neutral-300"/>
                </td>
                <td className="p-4">
                  <input type="checkbox" checked={!!c.selected} onChange={()=>toggle(c.code)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
