package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * 🔭 Device watchlist — flag a device once, get alerted when a *new* account
 * starts playing from it. This is how a banned farmer is caught on his first
 * comeback match instead of his twentieth.
 */
@JsonClass(generateAdapter = true)
data class WatchlistResponse(
    val devices: List<WatchedDevice> = emptyList(),
    val totalWatched: Int = 0,
    val totalAlerts: Int = 0,
)

@JsonClass(generateAdapter = true)
data class WatchedDevice(
    val id: String = "",
    @Json(name = "deviceId") val deviceId: String = "",
    val note: String? = null,
    @Json(name = "isActive") val isActive: Boolean = false,
    @Json(name = "alertCount") val alertCount: Int = 0,
    @Json(name = "lastSeenAt") val lastSeenAt: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "accountCount") val accountCount: Int = 0,
    @Json(name = "bannedCount") val bannedCount: Int = 0,
    @Json(name = "newAccountCount") val newAccountCount: Int = 0,
    @Json(name = "collidedMatchCount") val collidedMatchCount: Int = 0,
    @Json(name = "totalWinnings") val totalWinnings: Double = 0.0,
) {
    val shortDeviceId: String
        get() = if (deviceId.length > 12) deviceId.take(8) + "…" + deviceId.takeLast(4) else deviceId
}

/** POST /admin/players/watchlist */
@JsonClass(generateAdapter = true)
data class WatchDeviceRequest(
    @Json(name = "deviceId") val deviceId: String,
    val note: String? = null,
)

/** DELETE / PATCH responses on the watchlist. */
@JsonClass(generateAdapter = true)
data class WatchDeviceActionResponse(
    @Json(name = "deviceId") val deviceId: String = "",
    val removed: Int = 0,
    val cleared: Int = 0,
)
