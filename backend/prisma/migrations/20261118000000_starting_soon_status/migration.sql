-- Kickoff no longer means LIVE. A match whose start time has arrived moves to
-- STARTING_SOON and waits there until an admin/sub-admin presses "Go live".
ALTER TYPE "TournamentStatus" ADD VALUE 'STARTING_SOON' BEFORE 'LIVE';
