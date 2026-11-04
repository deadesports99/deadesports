import { prisma } from '../config/prisma.js';
import { generateToken } from '../services/auth.service.js';
import { execSync } from 'child_process';

async function main() {
  const tenantId = 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
  const targetUserId = '693498cb-5c00-4274-9d9b-7f9dae706e2b';
  const deviceId = '6103d5c2';

  console.log('⚡ Starting Realtime Live Wallet Float Test');

  // Find or create admin
  let admin = await prisma.user.findFirst({
    where: { tenantId, role: 'ADMIN' },
  });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        tenantId,
        phoneNumber: '9999999999',
        name: 'Master Admin',
        role: 'ADMIN',
      },
    });
  }

  const adminToken = generateToken({
    userId: admin.id,
    tenantId,
    role: 'ADMIN',
  });

  // Generate a random 12-char alphanumeric UTR
  const randomUTR = 'UTR' + Math.floor(100000000 + Math.random() * 900000000);

  // Create a pending deposit request for target user
  const deposit = await prisma.depositRequest.create({
    data: {
      tenantId,
      userId: targetUserId,
      amount: 100, // +₹100
      utrNumber: randomUTR,
      status: 'PENDING',
    },
  });

  console.log(`Created PENDING deposit ₹100 with UTR: ${randomUTR} (ID: ${deposit.id})`);

  // Capture screen right before approval
  console.log('📸 Screencap before approval...');
  execSync(`adb -s ${deviceId} shell screencap -p /sdcard/screen_wallet_pre.png`);
  execSync(`adb -s ${deviceId} pull /sdcard/screen_wallet_pre.png "C:\\Users\\Jay Kumar\\.gemini\\antigravity-cli\\brain\\f6ac20d1-0d45-42c8-afeb-61a9d1753a89\\screen_wallet_pre.png"`);

  // Trigger deposit approval on port 5000 using correct admin route
  console.log('🚀 Approving deposit via Admin API on running backend daemon...');
  const t0 = performance.now();
  const resp = await fetch(`http://localhost:5000/api/v1/admin/wallet/deposits/${deposit.id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
  });

  const resJson = await resp.json();
  const duration = Math.round(performance.now() - t0);
  console.log(`⏱️ Approve API responded in ${duration}ms:`, resJson);

  // Wait 400ms for websocket event to update Compose StateFlow on device
  await new Promise((r) => setTimeout(r, 400));

  // Capture screen right after realtime float
  console.log('📸 Screencap AFTER realtime balance float (Zero page refresh)...');
  execSync(`adb -s ${deviceId} shell screencap -p /sdcard/screen_wallet_post.png`);
  execSync(`adb -s ${deviceId} pull /sdcard/screen_wallet_post.png "C:\\Users\\Jay Kumar\\.gemini\\antigravity-cli\\brain\\f6ac20d1-0d45-42c8-afeb-61a9d1753a89\\screen_wallet_post.png"`);

  console.log('🎉 Wallet Real-Time Float Verification Complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
