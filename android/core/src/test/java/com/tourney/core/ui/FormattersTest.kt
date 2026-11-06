package com.tourney.core.ui

import java.time.LocalDate
import java.time.LocalTime
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Money and time formatting: the wallet shows these strings and players act on
 * them ("₹500 landed", "match at 08:00 PM"). A wrong zone or a stray decimal is
 * a support ticket, so the exact strings are pinned here.
 */
class FormattersTest {

    @Test
    fun `money hides decimals for whole rupees and keeps two for paise`() {
        assertEquals("500", formatMoney(500.0))
        assertEquals("0", formatMoney(0.0))
        assertEquals("1250", formatMoney(1250.0))
        assertEquals("0.50", formatMoney(0.5))
        assertEquals("1234.50", formatMoney(1234.5))
        assertEquals("99.99", formatMoney(99.99))
        assertEquals("-5", formatMoney(-5.0))
    }

    @Test
    fun `match time is rendered in IST, not the device clock`() {
        // 14:30 UTC is 20:00 IST.
        assertEquals("05 Nov, 08:00 PM", formatMatchTime("2026-11-05T14:30:00Z"))
        assertEquals("01 Jan 2027, 05:30 AM", formatMatchTimeFull("2027-01-01T00:00:00Z"))
        // 18:30 UTC is midnight IST of the NEXT day.
        assertEquals("06 Nov, 12:00 AM", formatMatchTime("2026-11-05T18:30:00Z"))
    }

    @Test
    fun `bad timestamps are shown verbatim instead of crashing the feed`() {
        assertEquals("not-a-date", formatMatchTime("not-a-date"))
        assertEquals("", formatMatchTime(""))
    }

    @Test
    fun `epoch helpers keep the Indian wall clock`() {
        // 2026-11-05 14:30:00 UTC
        val epoch = 1_793_889_000_000L
        assertEquals("05 Nov 2026", formatIstDate(epoch))
        assertEquals("Thu, 05 Nov 2026", formatIstDateWithWeekday(epoch))
        assertEquals("08:00 PM", formatIstTimeOfDay(epoch))
        assertEquals("05 Nov 2026, 08:00 PM", formatIstFullDateTime(epoch))
        assertEquals("05 Nov, 08:00 PM", formatIstDateTime(epoch))
    }

    @Test
    fun `an IST date and time convert to the correct instant`() {
        val epoch = istEpochMs(LocalDate.of(2026, 11, 5), LocalTime.of(20, 0))
        assertEquals("2026-11-05T14:30:00Z", java.time.Instant.ofEpochMilli(epoch).toString())
    }

    @Test
    fun `countdown labels stay short and readable`() {
        assertEquals("0m", formatDurationShort(0))
        assertEquals("0m", formatDurationShort(-5))
        assertEquals("45s", formatDurationShort(45))
        assertEquals("5m", formatDurationShort(300))
        assertEquals("2h", formatDurationShort(7_200))
        assertEquals("2h 15m", formatDurationShort(8_100))
        assertEquals("1d 4h", formatDurationShort(100_800))
        assertEquals("3d", formatDurationShort(259_200))
    }
}
