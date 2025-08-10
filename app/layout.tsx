import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deck Image Viewer',
  description: 'Paste a Pokemon TCG deck URL/code to view all JPG images on one page',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-neutral-50 text-neutral-800">
        <div className="max-w-5xl mx-auto p-6">{children}</div>
      </body>
    </html>
  );
}
