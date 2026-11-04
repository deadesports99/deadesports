const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../services/result.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      roomId: roomId.trim(),
      roomPassword: roomPassword.trim(),
      roomRevealedAt: new Date(),
      status: 'ROOM_REVEALED',
    },
  });

  // Push: alert every confirmed participant that the room is out (T-15 gate).
  
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

  void pushToTournamentParticipants(tournamentId, {
    type: 'ROOM_REVEALED',
    tournamentId,
    title: '🏟 Room ID Released!',
    body: \`Custom room unlocked for "\${updated.title}" — open the app for the code.\`,
  });`;

const replacement = `  const now = Date.now();
  const matchTimeMs = tournament.matchTime.getTime();
  const isWithinRevealWindow = now >= (matchTimeMs - ROOM_REVEAL_WINDOW_MS);

  // If match start is within 15 mins or already past, status becomes ROOM_REVEALED.
  // If admin sets it early (e.g. 20+ min before match), we store credentials in DB,
  // but keep status as-is so players cannot access until the T-15 minute window arrives!
  const newStatus = isWithinRevealWindow ? 'ROOM_REVEALED' : tournament.status;

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      roomId: roomId.trim(),
      roomPassword: roomPassword.trim(),
      roomRevealedAt: isWithinRevealWindow ? new Date() : null,
      status: newStatus,
    },
  });

  // Only broadcast & push to players if already within the 15-minute reveal window
  if (isWithinRevealWindow) {
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

    void pushToTournamentParticipants(tournamentId, {
      type: 'ROOM_REVEALED',
      tournamentId,
      title: '🏟 Room ID Released!',
      body: \`Custom room unlocked for "\${updated.title}" — open the app for the code.\`,
    });
  }`;

// normalize CRLF
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const newContent = normalizedContent.replace(normalizedTarget, replacement);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully patched result.service.ts!');
} else {
  console.error('Target not found in result.service.ts');
  process.exit(1);
}
