// Sekali pakai: tukar kode izin Google (dari login clasp) jadi refresh token, lalu dienkripsi
// dengan kunci publik penerima supaya log publik tidak membocorkan apa pun.
import crypto from 'crypto';
const CID = '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com', CSEC = 'v6V3fKV_zWU7iw1DrpO1rknX';
const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: CID, client_secret: CSEC, code: process.env.KODE, code_verifier: process.env.VERIFIER, redirect_uri: 'http://localhost:8888', grant_type: 'authorization_code' }) });
const j = await r.json();
if (!j.refresh_token) { console.log('Gagal: ' + (j.error || '') + ' ' + (j.error_description || '')); process.exit(1); }
const pub = Buffer.from(process.env.KUNCI_PUBLIK, 'base64').toString();
const aes = crypto.randomBytes(32), iv = crypto.randomBytes(12);
const c = crypto.createCipheriv('aes-256-gcm', aes, iv); const enc = Buffer.concat([c.update(j.refresh_token, 'utf8'), c.final()]);
const wk = crypto.publicEncrypt({ key: pub, oaepHash: 'sha256' }, aes);
console.log('TERENKRIPSI:' + [wk, iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.'));
