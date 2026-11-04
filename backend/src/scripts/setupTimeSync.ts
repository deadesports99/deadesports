import { prisma } from '../config/prisma.js';

async function main() {
  console.log('⚡ Initializing Supabase PostgreSQL Server-Time & Tamper-Proof Engine...');

  // 1. Create function get_server_time()
  await prisma.$queryRawUnsafe(`
    CREATE OR REPLACE FUNCTION get_server_time()
    RETURNS json
    LANGUAGE sql
    STABLE
    AS $$
      SELECT json_build_object(
        'utc_now', NOW(),
        'ist_now', NOW() AT TIME ZONE 'Asia/Kolkata',
        'ist_formatted', TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS'),
        'epoch_ms', (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
        'timezone', 'Asia/Kolkata',
        'offset_minutes', 330
      );
    $$;
  `);
  console.log('✔ Function get_server_time() installed in Supabase');

  // 2. Create function sync_match_lifecycle()
  await prisma.$queryRawUnsafe(`
    CREATE OR REPLACE FUNCTION sync_match_lifecycle()
    RETURNS json
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_revealed_count integer := 0;
      v_live_count integer := 0;
    BEGIN
      -- Advance matches to ROOM_REVEALED if within 15 mins of matchTime (using Supabase server clock)
      WITH updated_revealed AS (
        UPDATE "Tournament"
        SET status = 'ROOM_REVEALED',
            "roomRevealedAt" = COALESCE("roomRevealedAt", NOW())
        WHERE status IN ('DRAFT', 'UPCOMING', 'OPEN', 'SLOTS_FULL')
          AND "matchTime" <= (NOW() + INTERVAL '15 minutes')
        RETURNING id
      )
      SELECT count(*) INTO v_revealed_count FROM updated_revealed;

      -- Advance matches to LIVE if matchTime has arrived (using Supabase server clock)
      WITH updated_live AS (
        UPDATE "Tournament"
        SET status = 'LIVE'
        WHERE status = 'ROOM_REVEALED'
          AND "matchTime" <= NOW()
        RETURNING id
      )
      SELECT count(*) INTO v_live_count FROM updated_live;

      RETURN json_build_object(
        'success', true,
        'synced_at_ist', TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS'),
        'epoch_ms', (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
        'revealed_count', v_revealed_count,
        'live_count', v_live_count
      );
    END;
    $$;
  `);
  console.log('✔ Function sync_match_lifecycle() installed in Supabase');

  // 3. Verify functions by calling them
  const serverTimeResult: any = await prisma.$queryRawUnsafe(`SELECT get_server_time() as time_info;`);
  console.log('👉 Verified Supabase Server Time:', serverTimeResult[0].time_info);

  const lifecycleResult: any = await prisma.$queryRawUnsafe(`SELECT sync_match_lifecycle() as sync_info;`);
  console.log('👉 Verified Match Lifecycle Sync:', lifecycleResult[0].sync_info);
}

main().catch(console.error).finally(() => prisma.$disconnect());
