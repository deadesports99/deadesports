package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One seat on the public "who joined" list. Deliberately carries no phone
 * number or Free Fire UID — other players only ever see an in-game name.
 *
 * @property position 1-based join order (1 = booked first).
 */
@JsonClass(generateAdapter = true)
data class JoinedPlayerEntry(
    val position: Int = 0,
    @Json(name = "slotNumber") val slotNumber: Int = 0,
    val ign: String? = null,
    @Json(name = "joinedAt") val joinedAt: String? = null,
    @Json(name = "isBanned") val isBanned: Boolean = false,
)

/** GET /tournaments/:id/players — earliest join first. */
@JsonClass(generateAdapter = true)
data class JoinedPlayersResponse(
    @Json(name = "totalSlots") val totalSlots: Int = 0,
    val joined: Int = 0,
    val players: List<JoinedPlayerEntry> = emptyList(),
)
