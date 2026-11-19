-- Section-by-section staff permissions.
--
-- The owner asked that a staff permission key can grant each admin-console
-- SECTION on its own: Create Match, Manage Matches, Final Payout (view) and
-- releasing real money. Two flags are new, the other four already existed.
--
--   canCreateMatch     → Create Match (new match, clone, visibility)
--   canManageMatch     → NEW: Manage Matches (board, kills, room, go-live, submit)
--   canUpdateRoomId    → Publish room (Room ID / password + reveal timing)
--   canViewPayout      → NEW: Final Payout desk (see submitted matches & totals)
--   canDistributePrize → release REAL money (payout, seat refunds)
--   canManageWallet    → deposits, withdrawals, online payments
--
-- Backfill keeps every existing staff member exactly as powerful as before the
-- split, so nobody silently loses access on deploy.

ALTER TABLE "User" ADD COLUMN "canManageMatch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "canViewPayout"  BOOLEAN NOT NULL DEFAULT false;

-- Existing staff: whatever opened Manage Matches keeps opening it.
UPDATE "User" SET "canManageMatch" = "canCreateMatch" WHERE "role" = 'SUB_ADMIN';
UPDATE "User" SET "canViewPayout"  = "canDistributePrize" WHERE "role" = 'SUB_ADMIN';

-- The owner (ADMIN) already bypasses every flag server-side; keep the row honest.
UPDATE "User" SET "canManageMatch" = true, "canViewPayout" = true WHERE "role" = 'ADMIN';
