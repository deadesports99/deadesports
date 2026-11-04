import { prisma } from '../config/prisma.js';
import { generateToken } from '../services/auth.service.js';
import { execSync } from 'child_process';

async function main() {
  const tenantId = 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
  const tournamentId = 'f9cf5dfc-c735-48fa-a7fd-de41a281b4db'; // 'kyu'
  const deviceId = '6103d5c2';

  console.log('⚡ Starting Realtime Match Status Transition Test');

  // Admin token
  const admin = await prisma.user.findFirstOrThrow({
    where: { tenantId, role: 'ADMIN' },
  });

  const adminToken = generateToken({
    userId: admin.id,
    tenantId,
    role: 'ADMIN',
  });

  // Screen before room drop
  console.log('📸 Screencap before room release (kyu in Upcoming)...');
  execSync(`adb -s ${deviceId} shell screencap -p /sdcard/screen_match_upcoming.png`);
  execSync(`adb -s ${deviceId} pull /sdcard/screen_match_upcoming.png "C:\\Users\\Jay Kumar\\.gemini\\antigravity-cli\\brain\\f6ac20d1-0d45-42c8-afeb-61a9d1753a89\\screen_match_upcoming.png"`);

  // Release Custom Room ID & Password via API on port 5000
  console.log('🚀 Admin releasing Custom Room ID & Password on running daemon...');
  const t0 = performance.now();
  const resp = await fetch(`http://localhost:5000/api/v1/tournaments/${tournamentId}/room`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      roomId: '99887711',
      roomPassword: 'FF_PRO_PASS',
    }),
  });

  const resJson = await resp.json();
  const duration = Math.round(performance.now() - t0);
  console.log(`⏱️ Room API responded in ${duration}ms:`, resJson);

  // Wait 400ms for websocket event processing
  await new Promise((r) => setTimeout(r, 400));

  // Screencap Upcoming tab after status change (kyu should have moved out)
  console.log('📸 Screencap Upcoming tab after realtime status change...');
  execSync(`adb -s ${deviceId} shell screencap -p /sdcard/screen_upcoming_after_hop.png`);
  execSync(`adb -s ${deviceId} pull /sdcard/screen_upcoming_after_hop.png "C:\\Users\\Jay Kumar\\.gemini\\antigravity-cli\\brain\\f6ac20d1-0d45-42c8-afeb-61a9d1753a89\\screen_upcoming_after_hop.png"`);

  // Now switch to Live Matches tab on phone: tap "🔴 Live Matches" at x=730, y=190
  console.log('👉 Tapping Live Matches tab on device...');
  execSync(`adb -s ${deviceId} shell input tap 730 190`);
  await new Promise((r) => setTimeout(r, 500));

  // Screencap Live Matches tab (kyu should be here!)
  console.log('📸 Screencap Live tab (kyu should be live here)...');
  execSync(`adb -s ${deviceId} shell screencap -p /sdcard/screen_live_tab_with_kyu.png`);
  execSync(`adb -s ${deviceId} pull /sdcard/screen_live_tab_with_kyu.png "C:\\Users\\Jay Kumar\\.gemini\\antigravity-cli\\brain\\f6ac20d1-0d45-42c8-afeb-61a9d1753a89\\screen_live_tab_with_kyu.png"`);

  console.log('🎉 Match Lifecycle Transition Complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
