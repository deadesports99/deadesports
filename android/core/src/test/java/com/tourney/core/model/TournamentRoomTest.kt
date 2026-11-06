package com.tourney.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * Room ID rules and the join cutoff, straight off the owner's spec:
 *   • the room appears only when staff publish it (never on a clock),
 *   • joining closes 1 minute before kickoff.
 */
class TournamentRoomTest {

    private val kickoff = Instant.parse("2026-06-01T12:30:00Z")
    private val now = kickoff.toEpochMilli() - 3_600_000 // one hour before start

    private fun match(
        roomUnlocked: Boolean? = null,
        room: RoomCredentials? = null,
        roomRevealsAt: String? = null,
        status: TournamentStatus = TournamentStatus.OPEN,
        mySlot: MySlot? = MySlot(slotNumber = 7),
    ) = Tournament(
        id = "t1",
        title = "Bermuda Solo #1",
        gameMode = GameMode.BATTLE_ROYALE,
        matchType = MatchType.SOLO,
        mapType = MapType.BERMUDA,
        entryFee = "10",
        prizePool = "100",
        matchTime = kickoff.toString(),
        status = status,
        mySlot = mySlot,
        room = room,
        roomRevealsAt = roomRevealsAt,
        roomUnlocked = roomUnlocked,
    )

    @Test
    fun `a scheduled match with no published room stays locked`() {
        val t = match()
        assertFalse(t.isRoomUnlockedNow(now))
        assertFalse(t.isRoomReadyToView(now))
    }

    @Test
    fun `kickoff time alone never reveals the room`() {
        // Old T-15 window would open this; publishing is the only way now.
        val t = match()
        val justBeforeKickoff = kickoff.toEpochMilli() - 30_000
        assertFalse(t.isRoomUnlockedNow(justBeforeKickoff))
        assertEquals(Long.MAX_VALUE, t.secondsUntilRoomReveal(justBeforeKickoff))
    }

    @Test
    fun `published room unlocks instantly for a joined player`() {
        val t = match(
            status = TournamentStatus.ROOM_REVEALED,
            roomUnlocked = true,
            room = RoomCredentials(roomId = "88451230", roomPassword = "ff2026"),
        )
        assertTrue(t.isRoomUnlockedNow(now))
        assertTrue(t.isRoomReadyToView(now))
        assertEquals(0L, t.secondsUntilRoomReveal(now))
    }

    @Test
    fun `published room is hidden from players who never booked a seat`() {
        val t = match(
            status = TournamentStatus.ROOM_REVEALED,
            roomUnlocked = true,
            room = RoomCredentials(roomId = "88451230", roomPassword = "ff2026"),
            mySlot = null,
        )
        assertTrue(t.isRoomUnlockedNow(now))
        assertFalse(t.isRoomReadyToView(now))
    }

    @Test
    fun `join stays open until one minute before kickoff`() {
        val twoMinutes = kickoff.toEpochMilli() - 120_000
        assertFalse(match().isJoinClosed(twoMinutes))
    }

    @Test
    fun `join closes inside the last minute`() {
        assertTrue(match().isJoinClosed(kickoff.toEpochMilli() - 45_000))
        assertTrue(match().isJoinClosed(kickoff.toEpochMilli() - 60_000))
        assertTrue(match().isJoinClosed(kickoff.toEpochMilli() + 5_000))
    }
}
