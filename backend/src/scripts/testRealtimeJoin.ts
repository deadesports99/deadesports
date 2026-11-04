import { prisma } from '../config/prisma.js';
import { joinTournament } from '../services/tournament.service.js';

async function main() {
  const tenantId = 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
  const tournamentId = 'f9cf5dfc-c735-48fa-a7fd-de41a281b4db'; // 'kyu'

  console.log('--- 1. Creating or fetching Player 2 ---');
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
    // Ensure player2 has enough deposit balance
    await prisma.user.update({
      where: { id: player2.id },
      data: { depositBalance: 1000 },
    });
  }

  console.log('Player 2 ready:', player2.id, player2.name);

  // Check if player2 already joined; if so, remove slot first to re-test
  await prisma.tournamentSlot.deleteMany({
    where: { tournamentId, userId: player2.id },
  });

  console.log('--- 2. Player 2 joining tournament ---');
  const result = await joinTournament(
    {
      userId: player2.id,
      tenantId,
      role: 'USER',
      canCreateMatch: false,
      canUpdateRoomId: false,
      canDistributePrize: false,
      canManageWallet: false,
    },
    tournamentId,
    undefined,
    undefined,
    'PRO_SNIPER',
    '987654321'
  );

  console.log('Join result:', result);
  console.log('✅ Realtime SLOT_BOOKED should have been received by the phone now!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
