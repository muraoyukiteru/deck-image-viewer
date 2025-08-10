# Deck Image Viewer (v2, quantity-aware)

Public web app (Next.js + Vercel) that accepts a Pokemon TCG deck URL or deck code and shows card JPG images on one page.

**v2 change:** If a card has a quantity (e.g., ×2), the same image is duplicated that many times in the grid.

## Deploy to Vercel
- Import this repo into Vercel (Next.js, Node runtime).

## How it works
- API `/api/deck-images?deck=...` first switches to **リスト表示** to collect quantities per card (by anchor href).
- Then it switches to **画像表示** to collect each card image with its anchor href.
- It joins by href and **expands** the image list according to the quantity.
