import { prisma } from '../config/prisma.js';

async function main() {
  const result: any = await prisma.$queryRawUnsafe(`
    SELECT 
      NOW() as utc_now,
      NOW() AT TIME ZONE 'Asia/Kolkata' as ist_now,
      TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') as ist_formatted,
      EXTRACT(EPOCH FROM NOW()) * 1000 as epoch_ms;
  `);

  console.log('--- SUPABASE SERVER TIME (TAMPER PROOF) ---');
  console.log('UTC:', result[0].utc_now);
  console.log('IST (India):', result[0].ist_now);
  console.log('IST Formatted:', result[0].ist_formatted);
  console.log('Epoch (ms):', result[0].epoch_ms);
}

main().catch(console.error).finally(() => prisma.$disconnect());
