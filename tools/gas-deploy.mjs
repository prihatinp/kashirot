// Pasang backend/Code.gs ke Apps Script & perbarui Web App (URL tetap). Dipakai oleh GitHub Actions.
// Env: GAS_REFRESH_TOKEN, GAS_SCRIPT_ID, GAS_DEPLOYMENT_ID (opsional: diambil dari kashirot.pages.dev/js/config.js)
import fs from 'fs';
const CID = '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com', CSEC = 'v6V3fKV_zWU7iw1DrpO1rknX';
const API = 'https://script.googleapis.com/v1/projects/';
const env = k => (process.env[k] || '').trim();
async function tokenAkses() {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID, client_secret: CSEC, refresh_token: env('GAS_REFRESH_TOKEN'), grant_type: 'refresh_token' }) });
  const j = await r.json(); if (!j.access_token) throw new Error('Gagal ambil token: ' + JSON.stringify(j)); return j.access_token;
}
async function idDeployment() {
  if (env('GAS_DEPLOYMENT_ID')) return env('GAS_DEPLOYMENT_ID');
  const t = await (await fetch('https://kashirot.pages.dev/js/config.js?' + Date.now())).text();
  const m = t.match(/macros\/s\/([A-Za-z0-9_-]+)\/exec/); if (!m) throw new Error('Deployment ID tidak ketemu di config.js'); return m[1];
}
const at = await tokenAkses(), sid = env('GAS_SCRIPT_ID'), did = await idDeployment();
const panggil = async (metode, jalur, body) => {
  const r = await fetch(API + sid + jalur, { method: metode, headers: { authorization: 'Bearer ' + at, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(metode + ' ' + jalur + ' -> ' + r.status + ' ' + JSON.stringify(j.error || j)); return j;
};
// 1. ambil isi proyek sekarang, ganti hanya file Code (manifest & file lain dibiarkan)
const isi = await panggil('GET', '/content');
const kode = fs.readFileSync('backend/Code.gs', 'utf8');
let ada = false;
isi.files = isi.files.map(f => { if (f.name === 'Code' && f.type === 'SERVER_JS') { ada = true; return { ...f, source: kode }; } return f; });
if (!ada) isi.files.push({ name: 'Code', type: 'SERVER_JS', source: kode });
await panggil('PUT', '/content', { files: isi.files });
// 2. buat versi baru & arahkan Web App ke versi itu
const sha = (env('GITHUB_SHA') || 'manual').slice(0, 7);
const v = await panggil('POST', '/versions', { description: 'auto ' + sha });
await panggil('PUT', '/deployments/' + did, { deploymentConfig: { scriptId: sid, versionNumber: v.versionNumber, manifestFileName: 'appsscript', description: 'auto ' + sha } });
console.log('✅ Code.gs terpasang. Versi ' + v.versionNumber + ', deployment ...' + did.slice(-6));
