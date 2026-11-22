#!/usr/bin/env bash
# Build KASHIROT untuk Cloudflare Pages (pola sama dengan Ibbas Mart & AC Sarpras).
#   Build command          : bash cloudflare-build.sh
#   Build output directory : dist
#   Environment variable   : KASHIROT_API_URL = URL /exec Apps Script (opsional; kalau kosong, isi manual di aplikasi)
set -euo pipefail
rm -rf dist && mkdir -p dist
cp -r index.html manifest.webmanifest sw.js _headers css js lib fonts icons dist/
printf 'window.KASHIROT_API_URL = "%s";\n' "${KASHIROT_API_URL:-}" > dist/js/config.js
echo "KASHIROT build OK -> dist/ (API URL: ${KASHIROT_API_URL:+terisi})"
