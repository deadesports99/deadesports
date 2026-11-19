package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * 📊 MATCH STATUS — the spectator-verified scoreboard for one match.
 *
 * Backed by `GET /tournaments/:id/results`, the same rows the staff spectator
 * console writes: placement, verified kills and the prize each player was paid.
 * Nothing here is computed on the phone; an empty list means the organiser has
 * not published anything yet (normal while a match is still live).
 */
@JsonClass(generateAdapter = true)
data class ScoreboardPlayer(
    val id: String = "",
    @Json(name = "inGameName") val inGameName: String? = null,
    @Json(name = "inGameUid") val inGameUid: String? = null,
)

@JsonClass(generateAdapter = true)
data class ScoreboardRow(
    /** 1..48, or null when the spectator never ranked this player. */
    val rank: Int? = null,
    val player: ScoreboardPlayer? = null,
    val kills: Int = 0,
    @Json(name = "prizeWon") val prizeWon: Double = 0.0,
    /** False while the row is drafted but the payout has not run yet. */
    @Json(name = "isApproved") val isApproved: Boolean = false,
    @Json(name = "isDisqualified") val isDisqualified: Boolean = false,
    @Json(name = "disqualifyReason") val disqualifyReason: String? = null,
) {
    val ign: String
        get() = player?.inGameName?.takeIf { it.isNotBlank() } ?: "Player"

    val isPaid: Boolean
        get() = isApproved && !isDisqualified
}

@JsonClass(generateAdapter = true)
data class MatchStatusTournament(
    val id: String = "",
    val title: String = "",
    /** "UPCOMING" | "LIVE" | "COMPLETED" | "CANCELLED" (server enum). */
    val status: String = "",
    @Json(name = "matchNumber") val matchNumber: Int? = null,
    @Json(name = "matchType") val matchType: MatchType = MatchType.SOLO,
    @Json(name = "mapType") val mapType: MapType = MapType.BERMUDA,
    @Json(name = "matchTime") val matchTime: String = "",
    /** Prisma Decimal arrives as a string. */
    @Json(name = "perKillPrize") val perKillPrize: String? = null,
) {
    val mapLabel: String
        get() = when (mapType) {
            MapType.BERMUDA -> "Bermuda"
            MapType.PURGATORY -> "Purgatory"
            MapType.KALAHARI -> "Kalahari"
            MapType.ALPINE -> "Alpine"
            MapType.NEXTERRA -> "Nexterra"
        }

    val matchTypeLabel: String
        get() = when (matchType) {
            MatchType.SOLO -> "Solo"
            MatchType.DUO -> "Duo"
            MatchType.SQUAD -> "Squad"
        }

    val perKillValue: Double
        get() = perKillPrize?.toDoubleOrNull() ?: 0.0

    val isLive: Boolean
        get() = status.uppercase() == "LIVE"

    val isFinished: Boolean
        get() = status.uppercase() in setOf("COMPLETED", "CANCELLED", "SETTLED")

    /** Scoreboard visible but the organiser has not paid out yet. */
    val isUnderReview: Boolean
        get() = status.uppercase() in setOf("UNDER_REVIEW")
}

/** GET /tournaments/:id/results */
@JsonClass(generateAdapter = true)
data class MatchStatusResponse(
    val tournament: MatchStatusTournament = MatchStatusTournament(),
    /** Sorted server-side: rank ascending, then kills descending. */
    val scoreboard: List<ScoreboardRow> = emptyList(),
) {
    val totalPrize: Double
        get() = scoreboard.sumOf { it.prizeWon }

    val totalKills: Int
        get() = scoreboard.sumOf { it.kills }

    val paidRows: Int
        get() = scoreboard.count { it.isPaid }

    val hasResults: Boolean
        get() = scoreboard.isNotEmpty()

    /** The one row that belongs to the player opening the screen. */
    fun rowFor(userId: String?): ScoreboardRow? =
        userId?.let { id -> scoreboard.firstOrNull { it.player?.id == id } }
}
