package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * 👥 Owner-only player management (GET /admin/players).
 * Search works on Player ID, phone, IGN or Free Fire UID.
 */
@JsonClass(generateAdapter = true)
data class AdminPlayer(
    val id: String,
    /** Auto-generated readable player ID, e.g. "APX-0001". */
    @Json(name = "playerCode") val playerCode: String? = null,
    @Json(name = "phoneNumber") val phoneNumber: String = "",
    val name: String? = null,
    val email: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    @Json(name = "inGameUid") val inGameUid: String? = null,
    @Json(name = "depositBalance") val depositBalance: String = "0",
    @Json(name = "winningBalance") val winningBalance: String = "0",
    @Json(name = "isBanned") val isBanned: Boolean = false,
    @Json(name = "matchesJoined") val matchesJoined: Int = 0,
    @Json(name = "createdAt") val createdAt: String? = null,
) {
    val depositValue: Double get() = depositBalance.toDoubleOrNull() ?: 0.0
    val winningValue: Double get() = winningBalance.toDoubleOrNull() ?: 0.0
    /** Best display name: playerCode → IGN → name → phone. */
    val displayName: String
        get() = playerCode ?: inGameName ?: name ?: phoneNumber
}

/** GET /admin/players response. */
@JsonClass(generateAdapter = true)
data class AdminPlayersResponse(
    val players: List<AdminPlayer> = emptyList(),
    val total: Int = 0,
)

/** PATCH /admin/players/:id/ban request. */
@JsonClass(generateAdapter = true)
data class BanPlayerRequest(
    @Json(name = "isBanned") val isBanned: Boolean,
)

/** PATCH /admin/players/:id/ban response. */
@JsonClass(generateAdapter = true)
data class BanPlayerResponse(
    val id: String = "",
    @Json(name = "playerCode") val playerCode: String? = null,
    @Json(name = "isBanned") val isBanned: Boolean = false,
)
