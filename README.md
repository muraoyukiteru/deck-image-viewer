# Deck Image Viewer (v4, list-view quantity join)

Reads card **quantities** from *リスト表示* first, then switches to *画像表示* to get each card image, and returns the image URLs **duplicated by quantity**.

## Local Dev
```bash
npm i
npm run dev -- -H 0.0.0.0 -p 3000
# http://localhost:3000
```

## Quick debug
Open: http://localhost:3000/api/deck-images?deck=<CODE>
- `count` should equal total cards (e.g. 60), not unique count.
