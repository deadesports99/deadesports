import { prisma } from '../config/prisma.js';
import { generateToken } from '../services/auth.service.js';
import { execSync } from 'child_process';

async function main() {
  const tenantId = 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
  const tournamentId = 'f9cf5dfc-c735-48fa-a7fd-de41a281b4db'; // 'kyu'
  const deviceId = '6103d5c2';
  const playerOnDevice = '693498cb-5c00-4274-9d9b-7f9dae706e2b';

  console.log('⚡ Starting Realtime Match Completion & Disappear Test');

  const admin = await prisma.user.findFirstOrThrow({
    where: { tenantId, role: 'ADMIN' },
  });

  const adminToken = generateToken({
    userId: admin.id,
    tenantId,
    role: 'ADMIN',
  });

  // Call Payout API
  console.log('🚀 Admin distributing prizes & completing match on running daemon...');
  const t0 = performance.now();
  const resp = await fetch(`http://localhost:5000/api/v1/tournaments/${tournamentId}/payout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      results: [
        {
          userId: playerOnDevice,
          verifiedKills: 5,
          rank: 1, // Winner!
        },
      ],
    }),
  });

  const resJson = await resp.json();
  const duration = Math.round(performance.now() - t0);
  console.log(`⏱️ Payout API responded in ${duration}ms:`, resJson);

  // Wait 400ms
  await new Promise((r) => setTimeout(r, 400));

  // Screencap Live Matches tab (count should decrease and match disappeared)
  console.log('📸 Screencap Live tab after match completion...');
  execSync(`adb -s ${deviceId} shell screencap -p /sdcard/screen_after_complete.png`);
  execSync(`adb -s ${deviceId} pull /sdcard/screen_after_complete.png "C:\\Users\\Jay Kumar\\.gemini\\antigravity-cli\\brain\\f6ac20d1-0d45-42c8-afeb-61a9d1753a89\\screen_after_complete.png"`);

  // Switch to Wallet tab to verify prize money arrived in real time!
  console.log('👉 Switching to Wallet tab at x=540, y=2300...');
  execSync(`adb -s ${deviceId} shell input tap 540 2300`);
  await new Promise((r) => setTimeout(r, 500));

  console.log('📸 Screencap Wallet tab with prize money credited...');
  execSync(`adb -s ${deviceId} shell screencap -p /sdcard/screen_wallet_prize.png`);
  execSync(`adb -s ${deviceId} pull /sdcard/screen_wallet_prize.png "C:\\Users\\Jay Kumar\\.gemini\\antigravity-cli\\brain\\f6ac20d1-0d45-42c8-afeb-61a9d1753a89\\screen_wallet_prize.png"`);

  console.log('🎉 Match Completion & Realtime Payout Verification Complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
