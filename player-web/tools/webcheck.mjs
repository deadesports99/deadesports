/**
 * Headless smoke test for the ported demo pages.
 *
 * Drives a real Chrome over the DevTools protocol: types a phone number, walks
 * the OTP screen and reports what the app looks like afterwards. Used while
 * wiring each page to the backend so we never claim "it works" from a build log.
 *
 * Usage: node tools/webcheck.mjs [http://127.0.0.1:5173] [--phone 9876500011]
 */
import WebSocket from 'ws';

const baseUrl = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://127.0.0.1:5173';
const phoneArg = process.argv.indexOf('--phone');
const phone = phoneArg > -1 ? process.argv[phoneArg + 1] : '9876500011';

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page' && t.url.includes('5173')) ?? targets.find((t) => t.type === 'page');
if (!page) throw new Error('no Chrome page target on :9222');

const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
await new Promise((resolve, reject) => {
  ws.once('open', resolve);
  ws.once('error', reject);
});

let id = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function send(method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve) => pending.set(callId, resolve));
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) {
    throw new Error(res.result.exceptionDetails.exception?.description ?? 'evaluation failed');
  }
  return res.result?.result?.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable');
await send('Runtime.enable');

// Start clean: drop any stored session and reload the SPA.
await evaluate(`window.localStorage.clear(); location.href='${baseUrl}'; 'ok'`);
await sleep(2500);

const heading = await evaluate(`document.body.innerText.slice(0, 400)`);
console.log('--- after load ---');
console.log(heading.split('\n').slice(0, 6).join(' / '));

// Fill the phone field the way React expects (native setter + input event).
await evaluate(`(() => {
  const input = document.querySelector('#phone-input');
  if (!input) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '${phone}');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()`);
await sleep(400);

await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /continue with phone/i.test(b.textContent));
  if (!btn) return 'no-button';
  btn.click();
  return 'clicked';
})()`);
await sleep(900);

const otpScreen = await evaluate(`document.body.innerText`);
console.log('--- otp screen ---');
console.log(otpScreen.split('\n').slice(0, 8).join(' / '));

const hasBoxes = await evaluate(`document.querySelectorAll('input[id^="otp-"]').length`);
console.log('otp boxes:', hasBoxes);

// Fill all six boxes.
await evaluate(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const digits = '482916';
  document.querySelectorAll('input[id^="otp-"]').forEach((box, i) => {
    setter.call(box, digits[i]);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return 'filled';
})()`);
await sleep(400);

await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /verify otp/i.test(b.textContent));
  if (!btn) return 'no-verify';
  btn.click();
  return 'verified';
})()`);
await sleep(3500);

const after = await evaluate(`document.body.innerText`);
console.log('--- after verify ---');
console.log(after.split('\n').slice(0, 10).join(' / '));

const session = await evaluate(`localStorage.getItem('thunder.auth.token') ? 'TOKEN_SAVED' : 'NO_TOKEN'`);
console.log('session:', session);

// --- feed (real API data, not mock) ---
const feed = await evaluate(`(() => {
  const text = document.body.innerText;
  return JSON.stringify({
    hasHeading: /UPCOMING MATCHES/i.test(text),
    lines: text.split(String.fromCharCode(10)).filter((l) => /match|slots|refresh|₹/i.test(l)).slice(0, 12),
  });
})()`);
console.log('--- feed ---');
console.log(feed);

// --- open the first match card, check the IGN/UID fields exist ---
await evaluate(`(() => {
  const card = [...document.querySelectorAll('article[role="button"]')]
    .find((el) => /ENTRY FEE/i.test(el.innerText));
  if (card) card.click();
  return card ? 'opened' : 'no-card';
})()`);
await sleep(700);
const sheet = await evaluate(`(() => {
  const text = document.body.innerText;
  const labels = ['In-Game Name (IGN)', 'Free Fire UID', 'Entry Fee', 'Your Available Balance'];
  return JSON.stringify({
    labels: labels.map((l) => [l, text.includes(l)]),
    inputs: document.querySelectorAll('input').length,
    button: (() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Join Slot|Add Cash to Join|Entry closed|Booking your slot/i.test(x.innerText));
      return b ? b.innerText + ' | disabled=' + b.disabled : 'none';
    })(),
  });
})()`);
console.log('--- join sheet ---');
console.log(sheet);

// --- fill IGN + UID and join for real ---
const joinOutcome = await evaluate(`(async () => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const inputs = [...document.querySelectorAll('input')];
  const ign = inputs.find((i) => /SpartanOP|In-Game/i.test(i.placeholder) || i.placeholder === 'e.g. SpartanOP');
  const uid = inputs.find((i) => /UID/i.test(i.placeholder));
  if (!ign || !uid) return 'no-identity-inputs';
  setter.call(ign, 'DemoSlayer');
  ign.dispatchEvent(new Event('input', { bubbles: true }));
  setter.call(uid, '123456789');
  uid.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const btn = [...document.querySelectorAll('button')].find((x) => /Confirm & Join Slot/i.test(x.innerText));
  if (!btn) return 'no-join-button';
  btn.click();
  await new Promise((r) => setTimeout(r, 3500));
  return document.body.innerText.slice(0, 500);
})()`);
console.log('--- after join click ---');
console.log(String(joinOutcome).split(String.fromCharCode(10)).slice(0, 8).join(' / '));

ws.close();
