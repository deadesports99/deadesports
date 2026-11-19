package com.tourney.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * My Matches card logic — the pure rules the Compose card renders.
 *
 * These are the same rules as the backend (`playerMatches.service.ts`) and the
 * web preview (`mappers.ts`), so a status never means one thing on the phone
 * and another in the browser.
 */
class MyMatchTest {

    private fun match(
        phase: String = "upcoming",
        status: String = "OPEN",
        roomUnlocked: Boolean = false,
        roomId: String? = null,
        result: MyMatchResult? = null,
        refunded: Boolean = false,
        refundAmount: Double = 0.0,
        banned: Boolean = false,
        net: Double? = null,
    ) = MyMatch(
        id = "t-1",
        matchNumber = 7,
        title = "Bermuda Solo #7",
        matchType = MatchType.SOLO,
        mapType = MapType.BERMUDA,
        matchTime = "2026-11-17T12:30:00.000Z",
        status = status,
        phase = phase,
        entryFee = 20.0,
        perKillPrize = 10.0,
        slotNumber = 12,
        roomUnlocked = roomUnlocked,
        room = if (roomId != null) RoomCredentials(roomId = roomId, roomPassword = "pass") else null,
        result = result,
        refunded = refunded,
        refundAmount = refundAmount,
        isBannedFromMatch = banned,
        net = net,
    )

    @Test
    fun `an upcoming seat is JOINED until the room is published`() {
        assertEquals(MyMatchPill("JOINED", MyMatchTone.CYAN), myMatchPill(match()))
        assertEquals(
            MyMatchPill("ROOM READY", MyMatchTone.AMBER),
            myMatchPill(match(status = "ROOM_REVEALED", roomUnlocked = true, roomId = "44556677")),
        )
    }

    @Test
    fun `a published room unlocks the action, an unpublished one does not`() {
        assertEquals(MyMatchActionKind.PENDING, myMatchAction(match()).kind)
        assertEquals(MyMatchActionKind.ROOM, myMatchAction(match(roomUnlocked = true, roomId = "12345")).kind)
        // roomUnlocked without an actual id is not enough to open a code sheet.
        assertEquals(MyMatchActionKind.PENDING, myMatchAction(match(roomUnlocked = true)).kind)
    }

    @Test
    fun `a finished match reports booyah, rank or pending as read-only status`() {
        val booyah = match(
            phase = "completed",
            status = "COMPLETED",
            result = MyMatchResult(rank = 1, kills = 6, prizeWon = 70.0, isApproved = true),
        )
        assertEquals(MyMatchPill("BOOYAH", MyMatchTone.GOLD), myMatchPill(booyah))
        // Finished matches keep their full scoreboard reachable.
        assertEquals(MyMatchActionKind.STATUS, myMatchAction(booyah).kind)
        assertEquals("View Status", myMatchAction(booyah).label)

        val fourth = match(
            phase = "completed",
            status = "COMPLETED",
            result = MyMatchResult(rank = 4, kills = 2),
        )
        assertEquals(MyMatchPill("RANK #4", MyMatchTone.EMERALD), myMatchPill(fourth))

        // No MatchResult row yet: never invent a rank or a prize.
        val pending = match(phase = "completed", status = "COMPLETED")
        assertEquals(MyMatchPill("RESULT PENDING", MyMatchTone.SLATE), myMatchPill(pending))
        // Declared-but-unpaid still opens the board (rows read "payout pending").
        assertEquals(MyMatchActionKind.STATUS, myMatchAction(pending).kind)
        assertEquals(null, pending.net)
    }

    @Test
    fun `disqualification and a match ban always win over the placement`() {
        val dq = match(
            phase = "completed",
            status = "COMPLETED",
            result = MyMatchResult(rank = 1, kills = 9, isDisqualified = true, disqualifyReason = "hacking"),
        )
        assertEquals(MyMatchPill("DISQUALIFIED", MyMatchTone.ROSE), myMatchPill(dq))
        assertEquals(MyMatchActionKind.STATUS, myMatchAction(dq).kind)

        val banned = match(banned = true)
        assertEquals(MyMatchPill("BANNED", MyMatchTone.ROSE), myMatchPill(banned))
        assertEquals(MyMatchActionKind.STATUS, myMatchAction(banned).kind)
    }

    @Test
    fun `a cancelled match shows the refund that actually landed`() {
        val refunded = match(phase = "cancelled", status = "CANCELLED", refunded = true, refundAmount = 20.0, net = 0.0)
        assertEquals(MyMatchPill("REFUNDED", MyMatchTone.SLATE), myMatchPill(refunded))
        assertEquals(MyMatchActionKind.STATUS, myMatchAction(refunded).kind)

        val cancelled = match(phase = "cancelled", status = "CANCELLED")
        assertEquals(MyMatchPill("CANCELLED", MyMatchTone.SLATE), myMatchPill(cancelled))
    }

    @Test
    fun `a live seat offers the status board even before the room is out`() {
        val live = match(phase = "live", status = "LIVE")
        assertEquals(MyMatchActionKind.STATUS, myMatchAction(live).kind)
        assertEquals("View Status", myMatchAction(live).label)

        // Room published wins: the code is the more urgent action.
        val liveWithRoom = match(phase = "live", status = "LIVE", roomUnlocked = true, roomId = "44556677")
        assertEquals(MyMatchActionKind.ROOM, myMatchAction(liveWithRoom).kind)
    }

    @Test
    fun `net outcome is a signed rupee string and blanks when not settled`() {
        assertEquals("—", formatMyMatchNet(null))
        assertEquals("+₹50", formatMyMatchNet(50.0))
        assertEquals("−₹20", formatMyMatchNet(-20.0))
        assertEquals("₹0", formatMyMatchNet(0.0))
    }

    @Test
    fun `the starts line counts down, never backwards`() {
        val kickoff = "2026-11-17T12:30:00.000Z"
        val startMs = java.time.Instant.parse(kickoff).toEpochMilli()

        assertEquals("in 1h 30m", myMatchTiming(kickoff, startMs - 90 * 60_000, MyMatchPhase.UPCOMING))
        assertEquals("in 45m", myMatchTiming(kickoff, startMs - 45 * 60_000, MyMatchPhase.UPCOMING))
        assertEquals("in 1m", myMatchTiming(kickoff, startMs - 20_000, MyMatchPhase.UPCOMING))
        assertEquals("starting shortly", myMatchTiming(kickoff, startMs + 5 * 60_000, MyMatchPhase.UPCOMING))
        assertEquals("in progress", myMatchTiming(kickoff, startMs + 5 * 60_000, MyMatchPhase.LIVE))
        assertEquals("", myMatchTiming("not-a-date", startMs, MyMatchPhase.UPCOMING))
    }

    @Test
    fun `bucket queries match the backend contract`() {
        assertEquals("all", MyMatchBucket.ALL.query)
        assertEquals("upcoming", MyMatchBucket.UPCOMING.query)
        assertEquals("live", MyMatchBucket.LIVE.query)
        assertEquals("completed", MyMatchBucket.COMPLETED.query)
        assertEquals("cancelled", MyMatchBucket.CANCELLED.query)
    }
}
