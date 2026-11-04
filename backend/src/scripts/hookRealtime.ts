import fs from 'fs';
import path from 'path';

function hookResultService() {
  const file = path.resolve('src/services/result.service.ts');
  let code = fs.readFileSync(file, 'utf8');

  if (!code.includes("import { realtimeService }")) {
    code = code.replace(
      "import { pushToTournamentParticipants, pushToUsers } from './fcm.service.js';",
      "import { pushToTournamentParticipants, pushToUsers } from './fcm.service.js';\nimport { realtimeService } from './realtime.service.js';"
    );
  }

  if (!code.includes("ROOM_CREDENTIALS_REVEALED")) {
    const target = "void pushToTournamentParticipants(tournamentId, {";
    const inject = `
  // Realtime WebSocket broadcast
  realtimeService.broadcastToTenant(staffUser.tenantId, 'MATCH_STATUS_CHANGED', {
    tournamentId,
    status: 'ROOM_REVEALED',
    roomRevealedAt: updated.roomRevealedAt,
  });

  // Privately deliver credentials to confirmed slot participants
  prisma.tournamentSlot.findMany({
    where: { tournamentId },
    select: { userId: true },
  }).then((confirmedSlots) => {
    if (confirmedSlots.length > 0) {
      realtimeService.sendToUsers(
        confirmedSlots.map((s) => s.userId),
        'ROOM_CREDENTIALS_REVEALED',
        {
          tournamentId,
          roomId: updated.roomId,
          roomPassword: updated.roomPassword,
          roomRevealedAt: updated.roomRevealedAt,
        },
      );
    }
  }).catch(() => {});

  `;
    code = code.replace(target, inject + target);
  }

  if (!code.includes("realtimeService.broadcastToTenant(staffUser.tenantId, 'MATCH_STATUS_CHANGED', {")) {
    const targetComp = code.includes('\r\n')
      ? "return {\r\n    tournamentId,\r\n    status: 'COMPLETED',"
      : "return {\n    tournamentId,\n    status: 'COMPLETED',";

    const injectComp = `
  // Realtime WebSocket broadcast match completion
  realtimeService.broadcastToTenant(staffUser.tenantId, 'MATCH_STATUS_CHANGED', {
    tournamentId,
    status: 'COMPLETED',
  });

  // Realtime balance update for all paid participants
  (async () => {
    try {
      for (const item of summary) {
        const u = await prisma.user.findUnique({
          where: { id: item.userId },
          select: { depositBalance: true, winningBalance: true },
        });
        if (u) {
          const dep = round2(Number(u.depositBalance));
          const win = round2(Number(u.winningBalance));
          realtimeService.sendToUser(item.userId, 'WALLET_UPDATED', {
            userId: item.userId,
            depositBalance: dep,
            winningBalance: win,
            totalBalance: round2(dep + win),
          });
          if (item.totalPrize > 0) {
            realtimeService.sendToUser(item.userId, 'PRIZE_WON', {
              tournamentId,
              totalPrize: item.totalPrize,
              rank: item.rank,
              verifiedKills: item.verifiedKills,
            });
          }
        }
      }
    } catch (e) {
      console.error('[realtime] failed to push prize wallet updates:', e);
    }
  })();

  `;
    code = code.replace(targetComp, injectComp + targetComp);
  }

  fs.writeFileSync(file, code, 'utf8');
  console.log('✅ result.service.ts updated');
}

function hookDepositService() {
  const file = path.resolve('src/services/deposit.service.ts');
  let code = fs.readFileSync(file, 'utf8');

  if (!code.includes("import { realtimeService }")) {
    code = code.replace(
      "import { pushToUser } from './fcm.service.js';",
      "import { pushToUser } from './fcm.service.js';\nimport { realtimeService } from './realtime.service.js';"
    );
  }

  if (!code.includes("DEPOSIT_APPROVED")) {
    const targetDep = code.includes('\r\n')
      ? "return {\r\n    deposit: toPlayerView(result.updated),"
      : "return {\n    deposit: toPlayerView(result.updated),";

    const injectDep = `
  // Realtime balance update to player
  (async () => {
    try {
      const u = await prisma.user.findUnique({
        where: { id: existing.userId },
        select: { depositBalance: true, winningBalance: true },
      });
      if (u) {
        const dep = round2(Number(u.depositBalance));
        const win = round2(Number(u.winningBalance));
        realtimeService.sendToUser(existing.userId, 'WALLET_UPDATED', {
          userId: existing.userId,
          depositBalance: dep,
          winningBalance: win,
          totalBalance: round2(dep + win),
        });
        realtimeService.sendToUser(existing.userId, 'DEPOSIT_APPROVED', {
          depositId: existing.id,
          amount: round2(Number(existing.amount)),
          utrNumber: existing.utrNumber,
          depositBalance: dep,
        });
      }
    } catch (e) {
      console.error('[realtime] deposit notification error:', e);
    }
  })();

  `;
    code = code.replace(targetDep, injectDep + targetDep);
  }

  fs.writeFileSync(file, code, 'utf8');
  console.log('✅ deposit.service.ts updated');
}

function hookMatchSweepService() {
  const file = path.resolve('src/services/matchSweep.service.ts');
  let code = fs.readFileSync(file, 'utf8');

  if (!code.includes("import { realtimeService }")) {
    code = code.replace(
      "import { pushToTournamentParticipants } from './fcm.service.js';",
      "import { pushToTournamentParticipants } from './fcm.service.js';\nimport { realtimeService } from './realtime.service.js';"
    );
  }

  if (!code.includes("realtimeService.broadcast('MATCH_STATUS_CHANGED'")) {
    const targetSweep1 = "roomRevealed.push({ id: candidate.id, title: candidate.title, matchTime: candidate.matchTime });";
    const injectSweep1 = `
    realtimeService.broadcast('MATCH_STATUS_CHANGED', {
      tournamentId: candidate.id,
      status: 'ROOM_REVEALED',
    });
`;
    code = code.replace(targetSweep1, targetSweep1 + injectSweep1);

    const targetSweep2 = "wentLive.push({ id: candidate.id, title: candidate.title, matchTime: candidate.matchTime });";
    const injectSweep2 = `
    realtimeService.broadcast('MATCH_STATUS_CHANGED', {
      tournamentId: candidate.id,
      status: 'LIVE',
    });
`;
    code = code.replace(targetSweep2, targetSweep2 + injectSweep2);
  }

  fs.writeFileSync(file, code, 'utf8');
  console.log('✅ matchSweep.service.ts updated');
}

hookResultService();
hookDepositService();
hookMatchSweepService();
