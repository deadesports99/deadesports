/**
 * Payment gateway smoke test (mock provider) — run with:
 *   cd backend && npx tsx src/scripts/testPaymentFlow.ts
 *
 * Covers the whole money path against the REAL database and the REAL HTTP app:
 *   1. create order (auth required)
 *   2. mock checkout page is served
 *   3. "Pay now" -> wallet credited exactly once
 *   4. duplicate pay / verify -> no double credit (idempotent)
 *   5. verify handshake with a valid signature is accepted
 *   6. webhook: bad signature rejected, good signature settles a second order
 *   7. amount limits enforced
 *
 * A throwaway tenant + player is created and deleted at the end.
 */
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { paymentConfig } from '../config/payment.js';
import { prisma } from '../config/prisma.js';

const results: { name: string; ok: boolean; detail?: string }[] = [];

function check(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main(): Promise<void> {
  const stamp = Date.now();
  const tenant = await prisma.tenant.create({
    data: { subdomain: `payment-smoke-${stamp}`, brandName: 'Payment Smoke Test' },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      phoneNumber: `9${String(stamp).slice(-9)}`,
      name: 'Smoke Tester',
      role: 'USER',
      depositBalance: 0,
    },
  });

  const token = jwt.sign(
    { userId: user.id, tenantId: tenant.id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '10m' },
  );

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const walletBalance = async (): Promise<number> => {
    const res = await fetch(`${base}/api/v1/wallet`, { headers: authHeaders });
    const json = (await res.json()) as { data?: { depositBalance?: string } };
    return Number(json.data?.depositBalance ?? NaN);
  };

  try {
    // 1. Create order
    const createRes = await fetch(`${base}/api/payments/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amountPaise: 10_000 }),
    });
    const created = (await createRes.json()) as {
      data?: {
        orderId: string;
        providerOrderId: string;
        amountPaise: number;
        checkoutUrl: string;
        keyId: string | null;
      };
      message?: string;
    };
    check('POST /api/payments/orders -> 201', createRes.status === 201, created.message);
    const order = created.data;
    check('order has providerOrderId + checkoutUrl', Boolean(order?.providerOrderId && order?.checkoutUrl));
    check('amount echoed in paise', order?.amountPaise === 10_000);

    // unauthorized access is rejected
    const noAuth = await fetch(`${base}/api/payments/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountPaise: 10_000 }),
    });
    check('order creation without JWT -> 401', noAuth.status === 401);

    // amount limits
    const tooSmall = await fetch(`${base}/api/payments/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amountPaise: 100 }),
    });
    check('below minimum -> 400', tooSmall.status === 400);

    // 2. Demo checkout page
    const page = await fetch(`${base}/api/payments/demo/checkout?orderId=${order!.providerOrderId}`);
    const html = await page.text();
    check('GET demo checkout -> 200 HTML', page.status === 200 && html.includes('Mock gateway'));

    // 3. Pay
    const before = await walletBalance();
    const payRes = await fetch(`${base}/api/payments/demo/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order!.providerOrderId, outcome: 'success' }),
    });
    const paid = (await payRes.json()) as {
      data?: { paymentId: string; signature: string; status: string };
    };
    check('POST demo pay -> CAPTURED', paid.data?.status === 'CAPTURED');
    const after = await walletBalance();
    check('wallet credited by ₹100', Math.round((after - before) * 100) === 10_000, `${before} -> ${after}`);

    // 4. Double credit protection
    await fetch(`${base}/api/payments/demo/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order!.providerOrderId, outcome: 'success' }),
    });
    const afterDouble = await walletBalance();
    check('second pay does NOT double-credit', afterDouble === after, `${after} -> ${afterDouble}`);

    const ledgerRows = await prisma.walletLedger.count({
      where: { userId: user.id, category: 'ADD_MONEY', referenceId: order!.orderId },
    });
    check('exactly one ADD_MONEY ledger row', ledgerRows === 1, `rows=${ledgerRows}`);

    // 5. Verify handshake
    const verifyRes = await fetch(`${base}/api/payments/verify`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        orderId: order!.orderId,
        paymentId: paid.data!.paymentId,
        signature: paid.data!.signature,
      }),
    });
    const verified = (await verifyRes.json()) as { data?: { alreadySettled?: boolean } };
    check(
      'POST /verify on captured order -> alreadySettled',
      verifyRes.status === 200 && verified.data?.alreadySettled === true,
    );

    const syncRes = await fetch(`${base}/api/payments/orders/${order!.orderId}/sync`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const synced = (await syncRes.json()) as { data?: { status?: string; alreadySettled?: boolean } };
    check(
      'POST /orders/:id/sync -> CAPTURED alreadySettled',
      syncRes.status === 200 && synced.data?.status === 'CAPTURED' && synced.data?.alreadySettled === true,
    );

    const badVerify = await fetch(`${base}/api/payments/verify`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        orderId: order!.orderId,
        paymentId: paid.data!.paymentId,
        signature: 'deadbeef',
      }),
    });
    check('verify with forged signature does not fail-close a captured order', badVerify.status === 200);

    // 6. Webhook — second order, signed raw body
    const order2Res = await fetch(`${base}/api/payments/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amountPaise: 5_000 }),
    });
    const order2 = ((await order2Res.json()) as { data: { orderId: string; providerOrderId: string } }).data;

    const webhookBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_webhook_${stamp}`,
            order_id: order2.providerOrderId,
            status: 'captured',
            amount: 5_000,
          },
        },
      },
    });

    const badHook = await fetch(`${base}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'deadbeef' },
      body: webhookBody,
    });
    check('webhook with bad signature -> 400', badHook.status === 400);

    const secret =
      paymentConfig.razorpay.webhookSecret ?? paymentConfig.razorpay.keySecret ?? paymentConfig.mockSecret;
    const goodSignature = crypto.createHmac('sha256', secret).update(webhookBody).digest('hex');
    const balanceBeforeHook = await walletBalance();
    const goodHook = await fetch(`${base}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': goodSignature },
      body: webhookBody,
    });
    check('webhook with valid signature -> 200', goodHook.status === 200);
    const balanceAfterHook = await walletBalance();
    check(
      'webhook credited ₹50 exactly once',
      Math.round((balanceAfterHook - balanceBeforeHook) * 100) === 5_000,
      `${balanceBeforeHook} -> ${balanceAfterHook}`,
    );

    const replay = await fetch(`${base}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': goodSignature },
      body: webhookBody,
    });
    const balanceAfterReplay = await walletBalance();
    check('webhook replay -> 200 and no extra credit', replay.status === 200 && balanceAfterReplay === balanceAfterHook);

    // 7. Failed payment marks the order FAILED
    const order3Res = await fetch(`${base}/api/payments/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amountPaise: 2_000 }),
    });
    const order3 = ((await order3Res.json()) as { data: { orderId: string; providerOrderId: string } }).data;
    await fetch(`${base}/api/payments/demo/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order3.providerOrderId, outcome: 'failure' }),
    });
    const statusRes = await fetch(`${base}/api/payments/orders/${order3.orderId}`, { headers: authHeaders });
    const status = ((await statusRes.json()) as { data?: { status?: string } }).data;
    check('failed payment -> order FAILED', status?.status === 'FAILED');

    // 8. Order ownership enforced
    const other = await prisma.user.create({
      data: { tenantId: tenant.id, phoneNumber: `8${String(stamp).slice(-9)}`, role: 'USER' },
    });
    const otherToken = jwt.sign(
      { userId: other.id, tenantId: tenant.id, role: other.role },
      env.JWT_SECRET,
      { expiresIn: '10m' },
    );
    const foreign = await fetch(`${base}/api/payments/orders/${order3.orderId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    check("another user's order -> 403", foreign.status === 403);
  } finally {
    server.close();
    // Cleanup: remove only this run's data.
    await prisma.walletLedger.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.paymentOrder.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.error('FAILED CHECKS:');
    for (const f of failed) console.error(` - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
