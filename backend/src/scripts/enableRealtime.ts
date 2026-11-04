import { prisma } from '../config/prisma.js';

async function main() {
  console.log('--- Checking and Enabling Realtime Publication on Supabase Tables ---');
  
  // 1. List current tables in supabase_realtime
  try {
    const pubTables = await prisma.$queryRawUnsafe<any[]>(
      `SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`
    );
    console.log('Current tables in supabase_realtime:', pubTables);

    const tablesToEnable = ['Tournament', 'TournamentSlot', 'User', 'WalletLedger', 'DepositRequest', 'MatchResult'];

    for (const table of tablesToEnable) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "public"."${table}" REPLICA IDENTITY FULL;`);
        console.log(`✔ Set REPLICA IDENTITY FULL on ${table}`);
      } catch (err: any) {
        console.warn(`Could not set REPLICA IDENTITY on ${table}:`, err.message);
      }

      const alreadyAdded = pubTables.some(t => t.tablename === table);
      if (!alreadyAdded) {
        try {
          await prisma.$executeRawUnsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE "public"."${table}";`);
          console.log(`✔ Added ${table} to supabase_realtime publication`);
        } catch (err: any) {
          console.warn(`Could not add ${table} to publication:`, err.message);
        }
      } else {
        console.log(`ℹ ${table} is already in supabase_realtime`);
      }
    }

    const updatedTables = await prisma.$queryRawUnsafe<any[]>(
      `SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`
    );
    console.log('Updated tables in supabase_realtime:', updatedTables);
  } catch (err: any) {
    console.error('Realtime configuration error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
