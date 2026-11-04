package com.tourney.core.ui

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** ₹ money with no trailing decimals when whole (e.g. ₹500 vs ₹0.50). */
fun formatMoney(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString()
    else String.format("%.2f", value)

val IST_ZONE: ZoneId = ZoneId.of("Asia/Kolkata")

private val timeFormat: DateTimeFormatter =
    DateTimeFormatter.ofPattern("dd MMM, hh:mm a").withZone(IST_ZONE)

/** "01 Nov, 08:00 PM" strictly in Indian Standard Time (IST). */
fun formatMatchTime(iso: String): String = try {
    timeFormat.format(Instant.parse(iso))
} catch (e: Exception) {
    iso
}

/** Format milliseconds strictly in Indian Standard Time (IST). */
fun formatIstDateTime(epochMs: Long): String = try {
    timeFormat.format(Instant.ofEpochMilli(epochMs))
} catch (e: Exception) {
    epochMs.toString()
}