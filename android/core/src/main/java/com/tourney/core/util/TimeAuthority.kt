package com.tourney.core.util

import android.os.SystemClock
import android.util.Log
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * 🕒 TIME AUTHORITY (ANTI-CLOCK-SPOOFING & IST ENGINE)
 *
 * Problem: Users can change their Android device system clock (e.g. Settings -> Date & Time)
 * to manipulate match countdowns, attempt to unlock rooms early, or confuse match schedules.
 *
 * Solution:
 * Uses Android's hardware monotonic clock `SystemClock.elapsedRealtime()`, which:
 *  1. Counts milliseconds since device boot including deep sleep.
 *  2. Is NEVER affected by user manual clock edits or timezone changes.
 *
 * When the server sends authoritative Indian Standard Time (epoch ms):
 *   offset = serverEpochMs - SystemClock.elapsedRealtime()
 * At any later moment:
 *   currentTimeMillis() = offset + SystemClock.elapsedRealtime()
 */
object TimeAuthority {
    private const val TAG = "TimeAuthority"
    val IST_ZONE: ZoneId = ZoneId.of("Asia/Kolkata")

    private val isSynchronized = AtomicBoolean(false)
    // Default offset initialized using system time until first server sync
    private val clockOffsetMs = AtomicLong(System.currentTimeMillis() - SystemClock.elapsedRealtime())

    fun isSynced(): Boolean = isSynchronized.get()

    /**
     * Synchronize with authoritative server time from Supabase / Backend.
     */
    fun sync(serverEpochMs: Long, source: String = "API") {
        if (serverEpochMs <= 0) return
        val elapsedBootMs = SystemClock.elapsedRealtime()
        val calculatedOffset = serverEpochMs - elapsedBootMs
        clockOffsetMs.set(calculatedOffset)
        isSynchronized.set(true)
        Log.d(TAG, "⚡ Synchronized server time from $source: epoch=$serverEpochMs (offset=$calculatedOffset ms)")
    }

    /**
     * Authoritative epoch milliseconds, completely immune to phone clock spoofing.
     */
    fun currentTimeMillis(): Long {
        return clockOffsetMs.get() + SystemClock.elapsedRealtime()
    }

    /**
     * Authoritative current Instant.
     */
    fun currentInstant(): Instant {
        return Instant.ofEpochMilli(currentTimeMillis())
    }

    /**
     * Current Indian Standard Time (IST) ZonedDateTime.
     */
    fun currentIstDateTime(): ZonedDateTime {
        return currentInstant().atZone(IST_ZONE)
    }
}
