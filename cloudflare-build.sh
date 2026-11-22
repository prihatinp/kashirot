#!/usr/bin/env bash
# Build KASHIROT untuk Cloudflare Pages (pola sama dengan Ibbas Mart & AC Sarpras).
#   Build command          : bash cloudflare-build.sh
#   Build output directory : dist
#   Environment variable   : KASHIROT_API_URL   = URL /exec Apps Script (opsional; kalau kosong, isi manual di aplikasi)
#                            KASHIROT_VIEW_TOKEN = TOKEN_LIHAT (opsional; kalau diisi, siapa pun yang punya link bisa
#                                                  'Sambung' langsung dalam mode lihat tanpa mengetik token)
set -euo pipefail
rm -rf dist && mkdir -p dist
cp -r index.html manifest.webmanifest sw.js _headers css js lib fonts icons dist/
printf 'window.KASHIROT_API_URL = "%s";\n' "${KASHIROT_API_URL:-}" > dist/js/config.js
printf 'window.KASHIROT_VIEW_TOKEN = "%s";\n' "${KASHIROT_VIEW_TOKEN:-}" >> dist/js/config.js
echo "KASHIROT build OK -> dist/ (API URL: ${KASHIROT_API_URL:+terisi}; token lihat: ${KASHIROT_VIEW_TOKEN:+terisi})"
