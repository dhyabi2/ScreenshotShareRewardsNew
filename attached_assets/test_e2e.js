// End-to-end test script for SCREENSHOT XNO MVP (real, no mocks, no simulation)
// Requires: node-fetch, form-data, sharp
import fetch from 'node-fetch';
import FormData from 'form-data';
import sharp from 'sharp';
import fs from 'fs';

const BACKEND = 'http://localhost:4000';
const TEST_IMAGE_PATH = 'test_image.png'; // Updated to .png extension
const TEST_WALLET = 'nano_1m5sqm7kamdfenoaimbi1uczuumck5haw6t5o7pm5zqo9dtreahec3uigabf'; // Use a real Nano wallet for payment test
const SELLER_WALLET = 'nano_1nsjb7a9raepaao6pbrt6fzhx1877kr9bpw63mt67zq1roxirfkb4cy3tdd3';// Use a real Nano wallet as seller

function log(action, data) {
  console.log(`[TEST LOG] ${new Date().toISOString()} | ${action}`, data || '');
}

async function uploadScreenshot() {
  log('Uploading screenshot');
  const form = new FormData();
  form.append('screenshot', fs.createReadStream(TEST_IMAGE_PATH));
  form.append('title', 'Test Screenshot ' + new Date().toISOString()); // Add title
  form.append('price', '0.01'); // 0.01 XNO for test
  form.append('wallet', SELLER_WALLET);
  const res = await fetch(`${BACKEND}/api/upload`, {
    method: 'POST',
    body: form
  });
  const data = await res.json();
  log('Upload response', data);
  if (!res.ok || !data.success || !data.urls || !data.urls.original || !data.urls.blurred) throw new Error('Upload failed');
  // Check URLs are accessible
  const origUrl = `${BACKEND}${data.urls.original}`;
  const blurUrl = `${BACKEND}${data.urls.blurred}`;
  const blurRes = await fetch(blurUrl);
  const origRes = await fetch(origUrl);
  if (!blurRes.ok || !origRes.ok) throw new Error('Uploaded images not accessible');
  log('Image URLs accessible');
  return { origUrl, blurUrl };
}

async function checkWallet() {
  log('Checking wallet');
  const res = await fetch(`${BACKEND}/api/wallet/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: SELLER_WALLET })
  });
  const data = await res.json();
  log('Wallet verify response', data);
  if (!res.ok || !data.valid) throw new Error('Wallet verification failed');
}

async function checkBalance() {
  log('Checking balance');
  const res = await fetch(`${BACKEND}/api/wallet/balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: SELLER_WALLET })
  });
  const data = await res.json();
  log('Wallet balance response', data);
  if (!res.ok || !data.balance) throw new Error('Balance check failed');
}

async function checkPayment() {
  log('Checking payment (should be true if payment made)');
  const res = await fetch(`${BACKEND}/api/payment/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: TEST_WALLET,
      to: SELLER_WALLET,
      amount: '0.01'
    })
  });
  const data = await res.json();
  log('Payment check response', data);
  if (!res.ok) throw new Error('Payment check failed');
  return data.paid;
}

async function healthCheck() {
  log('Health check');
  const res = await fetch(`${BACKEND}/api/health`);
  const data = await res.json();
  log('Health check response', data);
  if (!res.ok || data.status !== 'ok') throw new Error('Health check failed');
}

// Run E2E test
(async () => {
  try {
    await healthCheck();
    await checkWallet();
    await checkBalance();
    const paid = await checkPayment();
    if (!paid) {
      log('Payment NOT found. Unlock should fail.');
      return;
    }
    log('Payment FOUND! Unlock should succeed.');
    await uploadScreenshot();
    log('E2E test completed successfully');
  } catch (err) {
    log('E2E test failed', err);
    process.exit(1);
  }
})();
