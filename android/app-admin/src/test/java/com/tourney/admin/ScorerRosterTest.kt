package com.tourney.admin

import com.tourney.core.model.SlotEntry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScorerRosterTest {

    private fun booked(slot: Int, id: String, name: String = "IGN$slot", uid: String = "UID$slot") =
        SlotEntry(slotNumber = slot, teamId = null, player = SlotEntry.SlotPlayer(id = id, inGameName = name, inGameUid = uid))

    private fun empty(slot: Int) = SlotEntry(slotNumber = slot, teamId = null, player = null)

    @Test
    fun `empty seats are dropped so list keys stay unique`() {
        val roster = scorerRoster(listOf(empty(1), booked(2, "u-2"), empty(3), booked(4, "u-4")))

        assertEquals(listOf(2, 4), roster.map { it.slotNumber })
        assertEquals(roster.size, roster.map { it.slotNumber }.distinct().size)
        assertTrue(roster.none { it.userId.isBlank() })
    }

    @Test
    fun `a full 48 seat list keeps only the players who booked`() {
        val seats = (1..48).map { if (it % 12 == 0) booked(it, "u-$it") else empty(it) }

        val roster = scorerRoster(seats)

        assertEquals(4, roster.size)
        assertEquals(listOf(12, 24, 36, 48), roster.map { it.slotNumber })
    }

    @Test
    fun `participants are sorted by seat even when the API is unordered`() {
        val roster = scorerRoster(listOf(booked(30, "u-30"), booked(5, "u-5"), booked(18, "u-18")))

        assertEquals(listOf(5, 18, 30), roster.map { it.slotNumber })
    }

    @Test
    fun `default ranks follow seat order so the console starts fully ranked`() {
        val roster = scorerRoster(listOf(booked(2, "u-2"), booked(7, "u-7"), booked(9, "u-9")))

        assertEquals(listOf(1, 2, 3), roster.map { it.rank })
        assertTrue(roster.all { it.verifiedKills == 0 && !it.disqualified })
    }

    @Test
    fun `blank player id falls back to the seat id instead of an empty key`() {
        val roster = scorerRoster(listOf(booked(11, "  ", name = ""), booked(12, "u-12")))

        assertEquals("slot-11", roster[0].userId)
        assertEquals("u-12", roster[1].userId)
        assertEquals("Player slot-11", roster[0].inGameName)
    }

    @Test
    fun `missing in-game name or uid still renders a row`() {
        val roster = scorerRoster(
            listOf(SlotEntry(slotNumber = 3, player = SlotEntry.SlotPlayer(id = "u-3", inGameName = null, inGameUid = null))),
        )

        assertEquals("Player u-3", roster.single().inGameName)
        assertEquals("-", roster.single().inGameUid)
    }

    @Test
    fun `no bookings yields an empty roster instead of a crash`() {
        assertTrue(scorerRoster((1..48).map { empty(it) }).isEmpty())
        assertTrue(scorerRoster(emptyList()).isEmpty())
    }
}
