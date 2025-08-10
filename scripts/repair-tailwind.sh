#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

# 1) 壊れた tailwind.config.js / .ts をプロジェクト全体から除去
while IFS= read -r -d '' f; do
  echo "[guard] remove: $f"
  rm -f "$f"
done < <(find "$root" -type f \( -name 'tailwind.config.js' -o -name 'tailwind.config.ts' \) -print0)

# 2) 正しい CJS を再生成（プロジェクト直下）
cat > "$root/tailwind.config.cjs" <<'CJS'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
CJS

# 3) PostCSS も正常形に
cat > "$root/postcss.config.js" <<'POST'
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
POST

# 4) globals.css 先頭に @tailwind が無ければ追記（上書きはしない）
if [ -f "$root/app/globals.css" ] && ! grep -q "@tailwind base;" "$root/app/globals.css"; then
  printf '%s\n%s\n%s\n\n' '@tailwind base;' '@tailwind components;' '@tailwind utilities;' | cat - "$root/app/globals.css" > "$root/app/.globals.css.tmp" && mv "$root/app/.globals.css.tmp" "$root/app/globals.css"
fi

# 5) BOM/CRLF を除去（Windows系混入対策）
sed -i '1s/^\xEF\xBB\xBF//' "$root/tailwind.config.cjs" "$root/postcss.config.js" "$root/app/globals.css" 2>/dev/null || true
sed -i 's/\r$//'         "$root/tailwind.config.cjs" "$root/postcss.config.js" "$root/app/globals.css" 2>/dev/null || true

# 6) 念のため .next を消しておく（差分が大きいとき用）
rm -rf "$root/.next" 2>/dev/null || true

echo "[guard] tailwind/postcss repaired. ready."
