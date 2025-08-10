
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プロキシメーカー',
  description: 'デッキURLや画像URLからカードを集めて印刷・一覧画像を作成',
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
