import { prisma } from '../config/prisma.js';
import { sweepMatchStates } from '../services/matchSweep.service.js';

async function main() {
  console.log('--- TESTING MATCH LIFECYCLE SYNC WITH SUPABASE ---');

  // Find the 'barmunda mtch' tournament
  const match = await prisma.tournament.findFirst({
    where: { title: 'barmunda mtch' },
  });

  if (!match) {
    console.log('Match not found');
    return;
  }

  console.log('Found match:', match.id, 'Status:', match.status, 'MatchTime:', match.matchTime);

  // Set its matchTime to NOW (so it goes LIVE)
  const dbNow: any = await prisma.$queryRawUnsafe('SELECT NOW() as now;');
  const currentTime = new Date(dbNow[0].now);
  console.log('Setting matchTime to Supabase NOW:', currentTime);

  await prisma.tournament.update({
    where: { id: match.id },
    data: { matchTime: currentTime },
  });

  // Run sweep
  console.log('Running match sweep...');
  const result = await sweepMatchStates();
  console.log('Sweep result:', result);

  const updated = await prisma.tournament.findUnique({
    where: { id: match.id },
    select: { id: true, title: true, status: true, matchTime: true },
  });
  console.log('Updated match status:', updated);
}

main().catch(console.error).finally(() => prisma.$disconnect());
