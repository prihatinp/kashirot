// HISAB AI lewat Cloudflare (cepat, jawaban mengalir). Env Cloudflare: GEMINI_API_KEY (Secret), KASHIROT_VIEW_TOKEN.
// Balasan: text/plain yang mengalir. Kalau belum dipasang/semua model penuh -> status 503 + JSON, aplikasi beralih ke Apps Script.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest'];
const UJI = [['gemini-3.5-flash-lite', null], ['gemini-3.5-flash-lite', 'minimal'], ['gemini-3.5-flash-lite', 'low'], ['gemini-flash-lite-latest', null], ['gemini-3.8-flash', 'minimal'], ['gemini-3.8-flash', 'low']];
const json = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) return json({ ok: false, error: 'belum-dipasang' }, 503);
  const asal = request.headers.get('origin'); if (asal && new URL(asal).host !== new URL(request.url).host) return json({ ok: false, error: 'asal' }, 403);
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'format' }, 400); }
  if (!b.token || (env.KASHIROT_VIEW_TOKEN && b.token !== env.KASHIROT_VIEW_TOKEN && String(b.token).length < 8)) return json({ ok: false, error: 'token' }, 401);
  const q = String(b.q || '').slice(0, 2000), konteks = String(b.konteks || '').slice(0, 60000);
  const sistem = 'Kamu HISAB, asisten Bendahara Umum Yayasan Ash-Shirot Al-Mustaqiem (Cikarang Selatan). Jawab singkat (maks. 8 kalimat atau poin), sopan, bahasa Indonesia yang santun dan mudah dipahami orang awam. Jangan pakai format markdown tebal/judul.\n' +
    '1) Untuk pertanyaan tentang keuangan yayasan (saldo, transaksi, piutang, hutang): jawab HANYA dari DATA di bawah, jangan mengarang angka; kalau data tidak cukup, katakan terus terang.\n' +
    '2) Untuk pertanyaan pengetahuan umum pembukuan, akuntansi, keuangan lembaga/yayasan, atau muamalah syariah: boleh dijawab dari pengetahuanmu, ringkas dan praktis untuk bendahara.\n' +
    '3) Jangan memberi nasihat hukum/pajak yang pasti; sarankan konsultasi ahli bila perlu.\n\nDATA:\n' + konteks;
  const models = (env.GEMINI_MODEL ? [env.GEMINI_MODEL] : []).concat(MODELS).filter((m, i, a) => a.indexOf(m) === i);
  for (const m of models) {
    const gc = { temperature: 0.3, maxOutputTokens: 2048 };
    if (/^gemini-2\.5/.test(m)) gc.thinkingConfig = { thinkingBudget: 0 };
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(12000),
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sistem }] }, contents: [{ role: 'user', parts: [{ text: q }] }], generationConfig: gc })
      });
    } catch { continue; }
    if (r.status === 401 || r.status === 403) return json({ ok: false, error: 'kunci-ditolak' }, 503);
    if (!r.ok) continue;                                   // 503/429 penuh, 404 model tak ada -> coba berikutnya
    // ubah SSE Gemini menjadi teks polos yang mengalir
    const dek = new TextDecoder(), enk = new TextEncoder(); let sisa = '';
    const alir = r.body.pipeThrough(new TransformStream({
      transform(chunk, ctl) {
        sisa += dek.decode(chunk, { stream: true });
        const baris = sisa.split('\n'); sisa = baris.pop();
        for (const l of baris) {
          if (!l.startsWith('data:')) continue;
          try { const j = JSON.parse(l.slice(5)); const t = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''); if (t) ctl.enqueue(enk.encode(t)); } catch { }
        }
      }
    }));
    return new Response(alir, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-hisab-model': m } });
  }
  return json({ ok: false, error: 'sibuk' }, 503);
}

// Diagnosa ringan: GET /api/hisab?cek=1 -> status & waktu tiap model (tanpa data yayasan, kunci tidak ditampilkan)
export async function onRequestGet({ request, env }) {
  if (!new URL(request.url).searchParams.has('cek')) return json({ ok: true, app: 'HISAB' }, 200);
  const hasil = { kunci: !!env.GEMINI_API_KEY, colo: request.cf?.colo, negara: request.cf?.country, model: [] };
  if (!env.GEMINI_API_KEY) return json(hasil, 200);
  for (const [m, lv] of UJI) {
    const t = Date.now(); let st, pesan = '';
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Jawab satu kata: halo' }] }], generationConfig: { maxOutputTokens: 200, ...(lv ? { thinkingConfig: { thinkingLevel: lv } } : {}) } }) });
      st = r.status; if (!r.ok) pesan = ((await r.json().catch(() => ({}))).error?.message || '').slice(0, 160);
    } catch (e) { st = 'gagal'; pesan = String(e.message || e).slice(0, 160); }
    hasil.model.push({ m, lv, st, ms: Date.now() - t, pesan });
  }
  return json(hasil, 200);
}
