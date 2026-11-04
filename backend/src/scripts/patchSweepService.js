const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../services/matchSweep.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `    roomRevealed.push({ id: candidate.id, title: candidate.title, matchTime: candidate.matchTime });
    realtimeService.broadcast('MATCH_STATUS_CHANGED', {
      tournamentId: candidate.id,
      status: 'ROOM_REVEALED',
    });

    void pushToTournamentParticipants(candidate.id, {`;

const replacement = `    roomRevealed.push({ id: candidate.id, title: candidate.title, matchTime: candidate.matchTime });
    realtimeService.broadcast('MATCH_STATUS_CHANGED', {
      tournamentId: candidate.id,
      status: 'ROOM_REVEALED',
    });

    // If room credentials were saved earlier by admin, deliver them to participants at T-15!
    if (candidate.roomId) {
      prisma.tournament.findUnique({
        where: { id: candidate.id },
        select: { roomId: true, roomPassword: true, roomRevealedAt: true },
      }).then((creds) => {
        if (creds?.roomId && creds.roomPassword) {
          prisma.tournamentSlot.findMany({
            where: { tournamentId: candidate.id },
            select: { userId: true },
          }).then((confirmedSlots) => {
            if (confirmedSlots.length > 0) {
              realtimeService.sendToUsers(
                confirmedSlots.map((s) => s.userId),
                'ROOM_CREDENTIALS_REVEALED',
                {
                  tournamentId: candidate.id,
                  roomId: creds.roomId,
                  roomPassword: creds.roomPassword,
                  roomRevealedAt: creds.roomRevealedAt,
                },
              );
            }
          });
        }
      }).catch(() => {});
    }

    void pushToTournamentParticipants(candidate.id, {`;

// normalize CRLF
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const newContent = normalizedContent.replace(normalizedTarget, replacement);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully patched matchSweep.service.ts!');
} else {
  console.error('Target not found in matchSweep.service.ts');
  process.exit(1);
}
