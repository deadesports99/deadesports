import { prisma } from '../config/prisma.js';
import { generateToken } from '../services/auth.service.js';
import { execSync } from 'child_process';

async function main() {
  const tenantId = 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
  const tournamentId = 'f9cf5dfc-c735-48fa-a7fd-de41a281b4db'; // 'kyu'
  const deviceId = '6103d5c2';

  console.log('⚡ Starting Real-Time End-to-End Verification Test');

  // 1. Ensure Player 2 exists and has balance
  let player2 = await prisma.user.findFirst({
    where: { tenantId, phoneNumber: '9876543210' },
  });

  if (!player2) {
    player2 = await prisma.user.create({
      data: {
        tenantId,
        phoneNumber: '9876543210',
        name: 'ProGamer_X',
        inGameName: 'PRO_SNIPER',
        inGameUid: '987654321',
        depositBalance: 1000,
        winningBalance: 0,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: player2.id },
      data: { depositBalance: 1000 },
    });
  }

  // Remove existing slot for player 2 if present
  await prisma.tournamentSlot.deleteMany({
    where: { tournamentId, userId: player2.id },
  });

  // Generate auth token for Player 2
  const token = generateToken({
    userId: player2.id,
    tenantId,
    role: 'USER',
  });

  // Step 2: Capture initial screen
  console.log('📸 Capturing screen BEFORE joining...');
  execSync(`adb -s ${deviceId} shell screencap -p /sdcard/screen_before.png`);
  execSync(`adb -s ${deviceId} pull /sdcard/screen_before.png "C:\\Users\\Jay Kumar\\.gemini\\antigravity-cli\\brain\\f6ac20d1-0d45-42c8-afeb-61a9d1753a89\\screen_before_realtime_join.png"`);

  // Step 3: Trigger join via HTTP API against running server on port 5000
  console.log('🚀 Triggering HTTP POST /tournaments/:id/join on running backend daemon...');
  const t0 = performance.now();
  const resp = await fetch(`http://localhost:5000/api/v1/tournaments/${tournamentId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      inGameName: 'PRO_SNIPER',
      inGameUid: '987654321',
    }),
  });

  const resJson = await resp.json();
  const duration = Math.round(performance.now() - t0);
  console.log(`⏱️ Join API returned in ${duration}ms:`, resJson);

  // Step 4: Wait 400ms for UI rendering
  await new Promise((r) => setTimeout(r, 400));

  // Step 5: Capture screen AFTER joining
  console.log('📸 Capturing screen AFTER realtime update (Zero reload)...');
  execSync(`adb -s ${deviceId} shell screencap -p /sdcard/screen_after.png`);
  execSync(`adb -s ${deviceId} pull /sdcard/screen_after.png "C:\\Users\\Jay Kumar\\.gemini\\antigravity-cli\\brain\\f6ac20d1-0d45-42c8-afeb-61a9d1753a89\\screen_after_realtime_join.png"`);

  // Step 6: Check logcat from the device
  const logs = execSync(`adb -s ${deviceId} logcat -d --pid=$(adb -s ${deviceId} shell pidof com.thunderesports.player)`).toString();
  const realtimeLines = logs.split('\n').filter((l) => l.includes('TourneyRealtime') || l.includes('SLOT_BOOKED')).slice(-10);
  console.log('📱 Phone Realtime Logs:\n' + realtimeLines.join('\n'));

  console.log('🎉 Verification complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
