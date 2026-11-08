package com.tourney.core.ui

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * ₹ money with no trailing decimals when whole (e.g. ₹500 vs ₹0.50) and
 * Indian digit grouping (₹2,000 / ₹1,20,000), matching the web app's en-IN format.
 */
fun formatMoney(value: Double): String {
    // Always two decimals while formatting, then drop them again when they are 00.
    val text = String.format(Locale.US, "%.2f", kotlin.math.abs(value))
    val whole = text.substringBefore('.')
    val fraction = text.substringAfter('.')
    val grouped = groupIndianDigits(whole)
    val body = if (fraction == "00") grouped else "$grouped.$fraction"
    return if (value < 0) "-$body" else body
}

/**
 * 2000 → "2,000" and 120000 → "1,20,000": the last three digits stay together,
 * every group before them is two digits wide (Indian numbering system).
 */
private fun groupIndianDigits(digits: String): String {
    if (digits.length <= 3) return digits
    val lastThree = digits.takeLast(3)
    var rest = digits.dropLast(3)
    val groups = mutableListOf<String>()
    while (rest.length > 2) {
        groups.add(0, rest.takeLast(2))
        rest = rest.dropLast(2)
    }
    if (rest.isNotEmpty()) groups.add(0, rest)
    return groups.joinToString(",") + "," + lastThree
}

val IST_ZONE: ZoneId = ZoneId.of("Asia/Kolkata")

// English locale keeps Indian date/time labels consistent (and gives the
// familiar uppercase AM / PM instead of the device locale's lowercase am/pm).
private val timeFormat: DateTimeFormatter =
    DateTimeFormatter.ofPattern("dd MMM, hh:mm a", Locale.ENGLISH).withZone(IST_ZONE)

/** Indian date, e.g. "05 Nov 2026" (IST). */
private val dateFormat: DateTimeFormatter =
    DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH).withZone(IST_ZONE)

/** Indian date with weekday, e.g. "Wed, 05 Nov 2026" (IST). */
private val dateWithWeekdayFormat: DateTimeFormatter =
    DateTimeFormatter.ofPattern("EEE, dd MMM yyyy", Locale.ENGLISH).withZone(IST_ZONE)

/** 12-hour Indian wall clock, e.g. "08:00 PM" (IST). */
private val timeOfDayFormat: DateTimeFormatter =
    DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH).withZone(IST_ZONE)

/** Full Indian date + 12-hour time, e.g. "05 Nov 2026, 08:00 PM" (IST). */
private val fullDateTimeFormat: DateTimeFormatter =
    DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a", Locale.ENGLISH).withZone(IST_ZONE)

/** "01 Nov, 08:00 PM" strictly in Indian Standard Time (IST). */
fun formatMatchTime(iso: String): String = try {
    timeFormat.format(Instant.parse(iso))
} catch (e: Exception) {
    iso
}

/** "01 Nov 2026, 08:00 PM" strictly in Indian Standard Time (IST). */
fun formatMatchTimeFull(iso: String): String = try {
    fullDateTimeFormat.format(Instant.parse(iso))
} catch (e: Exception) {
    iso
}

/** Format milliseconds strictly in Indian Standard Time (IST). */
fun formatIstDateTime(epochMs: Long): String = try {
    timeFormat.format(Instant.ofEpochMilli(epochMs))
} catch (e: Exception) {
    epochMs.toString()
}

/** "05 Nov 2026" — Indian date (IST). */
fun formatIstDate(epochMs: Long): String = try {
    dateFormat.format(Instant.ofEpochMilli(epochMs))
} catch (e: Exception) {
    epochMs.toString()
}

/** "Wed, 05 Nov 2026" — Indian date + weekday (IST). */
fun formatIstDateWithWeekday(epochMs: Long): String = try {
    dateWithWeekdayFormat.format(Instant.ofEpochMilli(epochMs))
} catch (e: Exception) {
    epochMs.toString()
}

/** "08:00 PM" — Indian 12-hour time (IST). */
fun formatIstTimeOfDay(epochMs: Long): String = try {
    timeOfDayFormat.format(Instant.ofEpochMilli(epochMs))
} catch (e: Exception) {
    epochMs.toString()
}

/** "05 Nov 2026, 08:00 PM" — Indian full date-time (IST). */
fun formatIstFullDateTime(epochMs: Long): String = try {
    fullDateTimeFormat.format(Instant.ofEpochMilli(epochMs))
} catch (e: Exception) {
    epochMs.toString()
}

/**
 * Build an epoch-ms instant from an Indian calendar date + wall-clock time.
 * Always uses Asia/Kolkata, so the schedule is correct even if the admin's
 * phone is set to a different time zone.
 */
fun istEpochMs(date: LocalDate, time: LocalTime): Long =
    date.atTime(time).atZone(IST_ZONE).toInstant().toEpochMilli()

/** "2h 15m", "45m", "3d 4h" — compact countdown label. */
fun formatDurationShort(seconds: Long): String {
    if (seconds <= 0L) return "0m"
    val days = seconds / 86_400L
    val hours = (seconds % 86_400L) / 3_600L
    val minutes = (seconds % 3_600L) / 60L
    return when {
        days > 0 && hours > 0 -> "${days}d ${hours}h"
        days > 0 -> "${days}d"
        hours > 0 && minutes > 0 -> "${hours}h ${minutes}m"
        hours > 0 -> "${hours}h"
        minutes > 0 -> "${minutes}m"
        else -> "${seconds}s"
    }
}
