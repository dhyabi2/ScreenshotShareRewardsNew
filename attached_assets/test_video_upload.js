// Real video upload test for screenshot-xno-backend (ESM compatible)
// Requires two real video files in the backend directory:
//   - test_video_short.mp4 (≤ 20s)
//   - test_video_long.mp4 (> 20s)
// No mocking or simulation. Logs all actions/results.

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = 'http://localhost:4000/api/upload';
const SHORT_VIDEO_PATH = path.join(__dirname, 'test_video_short.mp4');
const LONG_VIDEO_PATH = path.join(__dirname, 'test_video_long.mp4');
const WALLET = 'nano_3e3j5...'; // Replace with a valid wallet address for your test

function log(msg, data) {
  console.log(`[TEST LOG] ${new Date().toISOString()} | ${msg}`, data || '');
}

async function uploadVideo(filePath, label) {
  log(`Uploading video (${label})`, filePath);
  const form = new FormData();
  form.append('screenshot', fs.createReadStream(filePath));
  form.append('title', `${label} upload test`);
  form.append('price', '0.01');
  form.append('wallet', WALLET);

  const res = await fetch(API_URL, {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });
  const data = await res.json();
  log(`Upload response (${label})`, data);
  return data;
}

async function checkVideoUrl(url) {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:4000${url}`;
  log('Checking uploaded video URL', fullUrl);
  const res = await fetch(fullUrl);
  if (!res.ok) {
    throw new Error(`Video URL not accessible: ${fullUrl}`);
  }
  const contentType = res.headers.get('content-type');
  log('Returned content-type', contentType);
  if (!contentType.startsWith('video/') && contentType !== 'application/mp4') {
    throw new Error(`Returned file is not a video: ${contentType}`);
  }
  log('Video URL is accessible and content-type is valid', contentType);
}

async function runTests() {
  try {
    // Test 1: Upload a short (valid) video
    if (!fs.existsSync(SHORT_VIDEO_PATH)) {
      throw new Error(`Missing test video: ${SHORT_VIDEO_PATH}`);
    }
    const shortResp = await uploadVideo(SHORT_VIDEO_PATH, 'short');
    if (!shortResp.success || shortResp.type !== 'video' || !shortResp.urls.original) {
      throw new Error('Short video upload failed or response invalid');
    }
    await checkVideoUrl(shortResp.urls.original);
    log('Short video upload test PASSED');

    // Test 2: Upload a long (invalid) video
    if (!fs.existsSync(LONG_VIDEO_PATH)) {
      throw new Error(`Missing test video: ${LONG_VIDEO_PATH}`);
    }
    const longResp = await uploadVideo(LONG_VIDEO_PATH, 'long');
    if (longResp.success) {
      throw new Error('Long video upload should have failed, but succeeded');
    }
    if (!longResp.error || !longResp.error.toLowerCase().includes('long')) {
      throw new Error('Long video upload did not return expected error');
    }
    log('Long video upload test PASSED');
  } catch (err) {
    log('TEST FAILED', err);
    process.exit(1);
  }
  log('All video upload tests PASSED');
  process.exit(0);
}

runTests();
