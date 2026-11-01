package com.tourney.core.ui

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** ₹ money with no trailing decimals when whole (e.g. ₹500 vs ₹0.50). */
fun formatMoney(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString()
    else String.format("%.2f", value)

private val timeFormat: DateTimeFormatter =
    DateTimeFormatter.ofPattern("dd MMM, hh:mm a").withZone(ZoneId.systemDefault())

/** "01 Nov, 08:00 PM" from a backend ISO-8601 string. */
fun formatMatchTime(iso: String): String = try {
    timeFormat.format(Instant.parse(iso))
} catch (e: Exception) {
    iso
}