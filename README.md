# Deck Image Viewer

Public web app (Next.js + Vercel) that accepts a Pokemon TCG deck URL or deck code and shows all card JPG images on a single page.

## Deploy to Vercel

1. Create a repo on GitHub with these files (or upload the ZIP).
2. Go to **Vercel → New Project**, import the repo.
3. Framework preset: **Next.js** (Node.js runtime).
4. Deploy.

> The API uses headless Chromium via `@sparticuz/chromium` + `puppeteer-core`, which works on Vercel Serverless.

## Local Dev

```bash
npm i   # or yarn / pnpm
npm run dev # http://localhost:3000
```

## How it works
- The API route `/api/deck-images?deck=...` normalizes the deck ID and opens the **confirm** page.
- It toggles to **画像表示** (image view) if present, waits for images, then extracts all `*.jpg` URLs under `/card_images/`.
- The client page renders them in a responsive grid.

## Notes
- For personal/educational use. Follow the original site’s Terms; don’t rehost images.
- If the site structure changes, update selectors in `app/api/deck-images/route.ts`.
