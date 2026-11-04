const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../services/tournament.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `  const isStaff = Boolean(viewer && (viewer.role === 'ADMIN' || viewer.role === 'SUB_ADMIN'));

  return {
    items: items.map((t) => ({
      ...sanitizeTournament(t, isStaff),
      mySlotNumber: mySlotByTournamentId.get(t.id) ?? null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };`;

const replacement = `  const nowMs = Date.now();
  const isStaff = Boolean(viewer && (viewer.role === 'ADMIN' || viewer.role === 'SUB_ADMIN'));

  return {
    items: items.map((t) => {
      const mySlot = mySlotByTournamentId.get(t.id);
      const isConfirmedPlayer = mySlot !== undefined;
      const isWithin15Min = nowMs >= (t.matchTime.getTime() - 15 * 60 * 1000);
      const hasCreds = Boolean(t.roomId && t.roomPassword);
      const canSeeCreds = isStaff || (isConfirmedPlayer && isWithin15Min && hasCreds);

      return {
        ...sanitizeTournament(t, canSeeCreds),
        hasRoomCredentials: hasCreds,
        isRoomReady: isWithin15Min && hasCreds,
        mySlotNumber: mySlot ?? null,
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };`;

// normalize CRLF
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const newContent = normalizedContent.replace(normalizedTarget, replacement);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully patched tournament.service.ts!');
} else {
  console.error('Target not found in tournament.service.ts');
  process.exit(1);
}
