#!/usr/bin/env node
// Dev-only utility to send a correctly-signed SePay webhook to your endpoint.
// It NEVER hardcodes a secret — it reads SEPAY_WEBHOOK_SECRET from the env.
//
// Usage (PowerShell):
//   $env:SEPAY_WEBHOOK_SECRET="whsec_xxx"; node scripts/test-sepay-webhook.mjs `
//     --url http://localhost:3000/api/payments/sepay-webhook `
//     --code DH-ABCDEF-XY12 --amount 245000
//
// Usage (bash):
//   SEPAY_WEBHOOK_SECRET=whsec_xxx node scripts/test-sepay-webhook.mjs \
//     --url http://localhost:3000/api/payments/sepay-webhook \
//     --code DH-ABCDEF-XY12 --amount 245000
//
// Signature scheme (must match the server + SePay dashboard):
//   x-SePay-Signature: sha256=HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
//   x-SePay-Timestamp: <unix seconds>

import { createHmac } from 'node:crypto';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const secret = process.env.SEPAY_WEBHOOK_SECRET;
if (!secret) {
  console.error('ERROR: set SEPAY_WEBHOOK_SECRET in the environment first (do not hardcode it).');
  process.exit(1);
}

const url     = arg('url', 'http://localhost:3000/api/payments/sepay-webhook');
const code    = arg('code', 'DH-ABCDEF-XY12');
const amount  = parseInt(arg('amount', '245000'), 10);
const id      = parseInt(arg('id', String(Date.now() % 1_000_000)), 10);

const payload = {
  id,
  gateway:         'Sacombank',
  transactionDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
  accountNumber:   '060327399163',
  code:            null,
  content:         `THANH TOAN ${code} CUC HOA MI`,
  transferType:    'in',
  transferAmount:  amount,
  accumulated:     0,
  referenceCode:   `REF${id}`,
  description:     `THANH TOAN ${code}`,
};

const rawBody   = JSON.stringify(payload);
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');

console.log('POST', url);
console.log('x-SePay-Timestamp:', timestamp);
console.log('x-SePay-Signature:', signature);
console.log('body:', rawBody);

const res = await fetch(url, {
  method:  'POST',
  headers: {
    'Content-Type':      'application/json',
    'x-SePay-Timestamp': timestamp,
    'x-SePay-Signature': signature,
  },
  body: rawBody,
});

console.log('\n→ HTTP', res.status);
console.log('→ Response:', await res.text());
