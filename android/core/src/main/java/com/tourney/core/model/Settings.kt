package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Runtime tenant settings — owned by the client (Admin app) and read by every
 * player device. This is what makes the Add-Cash QR + WhatsApp support link
 * changeable without shipping a new APK.
 */
@JsonClass(generateAdapter = true)
data class TenantSettings(
    val brandName: String = "",
    @Json(name = "upiId") val upiId: String = "",
    @Json(name = "upiName") val upiName: String = "",
    @Json(name = "supportWhatsapp") val supportWhatsapp: String = "",
    @Json(name = "minDeposit") val minDeposit: Int = 10,
) {
    /** Never render a blank payee name. */
    val payeeName: String get() = upiName.ifBlank { brandName }
}

/** PATCH /admin/tenant/settings — only the fields being changed are sent. */
@JsonClass(generateAdapter = true)
data class UpdateTenantSettingsRequest(
    @Json(name = "upiId") val upiId: String? = null,
    @Json(name = "upiName") val upiName: String? = null,
    @Json(name = "supportWhatsapp") val supportWhatsapp: String? = null,
    @Json(name = "minDeposit") val minDeposit: Int? = null,
)

/** GET /players/me/stats — career card in the Profile tab. */
@JsonClass(generateAdapter = true)
data class PlayerStats(
    @Json(name = "matchesJoined") val matchesJoined: Int = 0,
    @Json(name = "matchesPlayed") val matchesPlayed: Int = 0,
    val booyahs: Int = 0,
    @Json(name = "totalKills") val totalKills: Int = 0,
    @Json(name = "totalWinnings") val totalWinnings: Double = 0.0,
    @Json(name = "bestRank") val bestRank: Int? = null,
)

/** One match advanced by the lifecycle sweep. */
@JsonClass(generateAdapter = true)
data class SweptMatch(
    val id: String,
    val title: String = "",
    @Json(name = "matchTime") val matchTime: String = "",
)

/** POST /tournaments/sweep/states — what the sweep changed right now. */
@JsonClass(generateAdapter = true)
data class SweepResult(
    @Json(name = "ranAt") val ranAt: String = "",
    @Json(name = "revealWindowMinutes") val revealWindowMinutes: Int = 15,
    @Json(name = "roomRevealed") val roomRevealed: List<SweptMatch> = emptyList(),
    @Json(name = "wentLive") val wentLive: List<SweptMatch> = emptyList(),
) {
    val totalChanges: Int get() = roomRevealed.size + wentLive.size
    val summary: String
        get() = when {
            totalChanges == 0 -> "Nothing due — all matches already up to date."
            else -> buildString {
                if (roomRevealed.isNotEmpty()) append("${roomRevealed.size} room(s) revealed")
                if (roomRevealed.isNotEmpty() && wentLive.isNotEmpty()) append(" • ")
                if (wentLive.isNotEmpty()) append("${wentLive.size} match(es) went LIVE")
            }
        }
}

/** POST /tournaments/:id/cancel — a reason (>= 5 chars) is mandatory. */
@JsonClass(generateAdapter = true)
data class CancelMatchRequest(val reason: String)

/** POST /tournaments/:id/cancel — atomic refund summary. */
@JsonClass(generateAdapter = true)
data class CancelMatchResult(
    @Json(name = "tournamentId") val tournamentId: String = "",
    val status: String = "",
    @Json(name = "refundedPlayers") val refundedPlayers: Int = 0,
    @Json(name = "totalRefunded") val totalRefunded: Double = 0.0,
)
