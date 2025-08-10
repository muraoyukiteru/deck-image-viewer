import './globals.css';
import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'ポケカ プロキシメーカー(POKEMON CARD PROXY MAKER)',
  description:
    'ポケモンカード（ポケカ）のプロキシを作成・印刷。デッキ構築、デッキコードから画像を一覧表示し、印刷用ページや一覧画像を生成できます。',
  keywords: [
    'ポケモンカード','ポケカ','プロキシ','作成','デッキ構築','デッキコード','印刷','プリント',
    'Pokemon Card','Proxy','Deck Code','Print'
  ],
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true }
  },
  openGraph: {
    title: 'ポケカ プロキシメーカー(POKEMON CARD PROXY MAKER)',
    description:
      'ポケモンカード（ポケカ）のプロキシを作成・印刷。デッキ構築、デッキコードから画像を一覧表示し、印刷用ページや一覧画像を生成。',
    url: '/',
    siteName: 'ポケカ プロキシメーカー',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ポケカ プロキシメーカー(POKEMON CARD PROXY MAKER)',
    description:
      'ポケモンカード（ポケカ）のプロキシを作成・印刷。デッキ構築、デッキコードから画像を一覧表示。',
  },
  alternates: { canonical: '/' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen text-neutral-800">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </body>
    </html>
  );
}