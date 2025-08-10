'use client';

import { useState } from 'react';

type ApiResult = {
  version?: string;
  deckId: string;
  source: string;
  count: number;
  images: string[];
  counts?: Record<string, number>;
  error?: string;
};

export default function Page() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [source, setSource] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setImages([]);
    setSource(null);
    const value = input.trim();
    if (!value) { setErr('URL か デッキコードを入力してください'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/deck-images?deck=${encodeURIComponent(value)}`, { cache: 'no-store' });
      const data: ApiResult = await res.json();
      if (!res.ok) throw new Error(data?.error || '取得に失敗しました');
      setImages(data.images || []);
      setSource(data.source || null);
      if ((data.images || []).length === 0) setErr('JPG 画像が見つかりませんでした。');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Deck Image Viewer</h1>
      <p className="text-sm text-neutral-600">
        URL（例：<code className="px-1 bg-neutral-100 rounded">https://www.pokemon-card.com/deck/deck.html?deckID=…</code>）
        またはデッキコード（例：<code className="px-1 bg-neutral-100 rounded">ggnNQ9-cFqwyn-NLLn6Q</code>）を入力して、
        カードの JPG を 1 ページに表示します。数量があるカードは同じ画像が枚数分表示されます。
      </p>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="デッキURL か デッキコード"
          className="flex-1 px-3 py-2 rounded-2xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-2xl bg-black text-white shadow disabled:opacity-60"
        >{loading ? '取得中…' : '表示'}</button>
      </form>

      {source && (
        <p className="text-xs text-neutral-500">参照: <a className="underline" href={source} target="_blank" rel="noreferrer">{source}</a></p>
      )}

      {err && (
        <div className="p-3 rounded-2xl bg-red-50 text-red-700 text-sm">{err}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((src, i) => (
          <a key={`${src}:${i}`} href={src} target="_blank" rel="noreferrer" className="block group">
            <img src={src} alt="card" className="w-full h-auto rounded-2xl shadow border border-neutral-200 group-hover:opacity-90"/>
          </a>
        ))}
      </div>

      <footer className="pt-6 text-xs text-neutral-500">
        画像の権利は各権利者に帰属します。サイトの規約に従ってご利用ください。
      </footer>
    </main>
  );
}
