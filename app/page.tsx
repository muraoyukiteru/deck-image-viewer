
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

  const totalSelected = useMemo(
    () => cards.reduce((sum, c) => sum + (c.selected ? c.qty : 0), 0),
    [cards]
  );
  const totalSelectedNoEnergy = useMemo(
    () => cards.reduce((sum, c) => {
      if (!c.selected) return sum;
      const isEnergy = (c.src || '').includes('E_KIHON');
      return sum + (isEnergy ? 0 : c.qty);
    }, 0),
    [cards]
  );

  async function fetchCardsFrom(value: string) {
    const res = await fetch(`/api/deck-cards?deck=${encodeURIComponent(value)}`, { cache: 'no-store' });
    const data: ApiResult = await res.json();
    if (!res.ok) throw new Error(data?.error || '取得に失敗しました');
    return (data.cards||[]) as Card[];
  }

  async function handleRefresh() {
    setErr(null); setLoading(true);
    try {
      const main = await fetchCardsFrom(deck);
      setCards(main.map(c=>({...c, selected:true })));
    } catch(e:any){ setErr(e.message); } finally { setLoading(false); }
  }

  async function handleAdd() {
    const v = extra.trim(); if(!v) return;
    setErr(null); setLoading(true);
    try {
      if (isImageUrl(v)) {
        const base = baseNameFromUrl(v); const code = `IMG:${base}`;
        setCards(prev => {
          const map = new Map(prev.map(c=>[c.code,{...c}]));
          if (map.has(code)) { const ex = map.get(code)!; ex.qty = Math.min(99, ex.qty+1); ex.src ||= v; ex.name ||= base; ex.selected = true; return Array.from(map.values()); }
          return [{ code, name: base||code, qty: 1, src: v, selected: true }, ...prev];
        });
      } else {
        const add = await fetchCardsFrom(v);
        setCards(prev => {
          const map = new Map(prev.map(c=>[c.code,{...c}]));
          const newOnes: any[] = [];
          for (const c of add) {
            const ex = map.get(c.code);
            if (ex) {
              ex.qty = Math.min(99, ex.qty + c.qty);
              ex.src ||= c.src;
              ex.selected ??= true;
            } else {
              newOnes.push({ ...c, selected: true });
              map.set(c.code, { ...c, selected: true });
            }
          }
          return [...newOnes, ...prev.map(c => map.get(c.code)! )];
        });
      }
      setExtra('');
    } catch(e:any){ setErr(e.message); } finally { setLoading(false); }
  }

  function setQty(code: string, v: number) {
    const val = Math.max(0, Math.min(99, Math.floor(Number.isFinite(v)?v:0)));
    setCards(cs=>cs.map(c=>c.code===code?{...c, qty:val}:c));
  }
  function inc(code: string, d: number) {
    setCards(cs=>cs.map(c=>c.code===code?{...c, qty: Math.max(0, Math.min(99, c.qty + d))}:c));
  }
  function toggle(code: string){ setCards(cs=>cs.map(c=>c.code===code?{...c, selected:!c.selected}:c)); }
  function toggleAll(){ const next=!allSelected; setCards(cs=>cs.map(c=>({...c, selected:next}))); }
  function openPrint(){ const selected = cards.filter(c=>c.selected && c.qty>0 && c.src); localStorage.setItem('proxy-print-v1', JSON.stringify({ deck, cards: selected })); window.open('/print','_blank'); }
  function openThumbs(){ const selected = cards.filter(c=>c.selected && c.qty>0 && c.src); localStorage.setItem('proxy-thumbs-v1', JSON.stringify({ deck, cards: selected })); window.open('/thumbs','_blank'); }

  function moveLeft(i: number){
    if (i<=0) return;
    setCards(cs => { const next = cs.slice(); const t = next[i-1]; next[i-1] = next[i]; next[i] = t; return next; });
  }
  function moveRight(i: number){
    setCards(cs => {
      if (i >= cs.length-1) return cs;
      const next = cs.slice(); const t = next[i+1]; next[i+1] = next[i]; next[i] = t; return next;
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "ポケカ プロキシメーカー(POKEMON CARD PROXY MAKER)",
    "url": "/",
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "Web",
    "description": "ポケモンカード（ポケカ）のプロキシを作成・印刷。デッキ構築、デッキコードから画像を一覧表示し、印刷用ページや一覧画像を生成できます。",
    "keywords": ["ポケモンカード","ポケカ","プロキシ","作成","デッキ構築","デッキコード","印刷","プリント"]
  };

  return (
    <main className="space-y-6">
      {/* JSON-LD for SEO */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="text-4xl font-extrabold text-blue-600">ポケカ プロキシメーカー(POKEMON CARD PROXY MAKER)</h1>

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

      {/* 全選択/全解除 と 合計表示 */}
      <div className="text-sm text-neutral-600 flex items-center gap-4">
        <button onClick={toggleAll} className="underline">{allSelected ? '全解除' : '全選択'}</button>
        <span>選択合計: <b>{totalSelected}</b> 枚</span>
        <span>（基本エネルギーを除く(印刷するカード枚数): <b>{totalSelectedNoEnergy}</b> 枚）</span>
      </div>

      {/* 4列カードグリッド */}
      <div className="grid grid-cols-4 gap-6">
        {cards.map((c, i) => (
          <div key={c.code} className="relative bg-white rounded-xl shadow border border-neutral-200 p-3">
            {/* 操作バー（左矢印・チェック・右矢印） */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <button
                onClick={() => moveLeft(i)}
                disabled={i===0}
                className={`pointer-events-auto w-6 h-6 rounded-full border bg-white text-xs grid place-items-center shadow ${i===0?'opacity-40 cursor-default':'hover:bg-neutral-50'}`}
                title="左へ"
              >◄</button>
              <input
                type="checkbox"
                checked={!!c.selected}
                onChange={()=>toggle(c.code)}
                className="pointer-events-auto w-5 h-5 accent-blue-600"
                title="選択"
              />
              <button
                onClick={() => moveRight(i)}
                disabled={i===cards.length-1}
                className={`pointer-events-auto w-6 h-6 rounded-full border bg-white text-xs grid place-items-center shadow ${i===cards.length-1?'opacity-40 cursor-default':'hover:bg-neutral-50'}`}
                title="右へ"
              >►</button>
            </div>

            {/* 画像 */}
            <div className="mt-6 mb-3 h-64 grid place-items-center">
              {c.src ? (
                <img src={c.src} alt={c.name} className="max-h-64 w-auto object-contain rounded-md border border-neutral-200"/>
              ) : (
                <div className="text-xs text-neutral-500">画像なし</div>
              )}
            </div>

            {/* 枚数表示＆操作 */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-lg font-semibold">{c.qty}</div>
              <div className="flex items-center gap-2">
                <button onClick={()=>inc(c.code,-1)} className="w-9 h-9 rounded-md border grid place-items-center">−</button>
                <input
                  type="number" min={0} max={99} value={c.qty}
                  onChange={e=>setQty(c.code, Number(e.target.value))}
                  className="w-12 text-center rounded-md border py-1"
                />
                <button onClick={()=>inc(c.code, +1)} className="w-9 h-9 rounded-md border grid place-items-center">＋</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
