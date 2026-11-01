package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Official Spectator Scoreboard (replacement for player screenshot uploads):
 * staff sits in the custom-room spectator slot, records verified results live,
 * and hits 1-click payout. Players see only this read-only scoreboard.
 */

/** GET /tournaments/:id/results wrapper. */
@JsonClass(generateAdapter = true)
data class ScoreboardResponse(
    val tournament: ScoreboardHeader,
    val scoreboard: List<ScoreboardEntry> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class ScoreboardHeader(
    val id: String,
    val title: String,
    val status: TournamentStatus,
    @Json(name = "prizePool") val prizePool: String,
    @Json(name = "perKillPrize") val perKillPrize: String,
)

/** One verified player row (order: rank asc, kills desc). */
@JsonClass(generateAdapter = true)
data class ScoreboardEntry(
    val rank: Int? = null,                       // 1 = Booyah; null = no rank awarded
    val player: ScoreboardPlayer? = null,
    val kills: Int = 0,                          // verifiedKills (spectator-verified)
    @Json(name = "prizeWon") val prizeWon: String = "0",
    @Json(name = "isApproved") val isApproved: Boolean = false,
    @Json(name = "isDisqualified") val isDisqualified: Boolean = false,
    @Json(name = "disqualifyReason") val disqualifyReason: String? = null,
) {
    val prizeValue: Double get() = prizeWon.toDoubleOrNull() ?: 0.0
}

@JsonClass(generateAdapter = true)
data class ScoreboardPlayer(
    val id: String,
    @Json(name = "inGameName") val inGameName: String?,
    @Json(name = "inGameUid") val inGameUid: String,
)

// ─── Payout (Admin / Spectator Scorer Console) ───────────────────────────

@JsonClass(generateAdapter = true)
data class PayoutResultInput(
    @Json(name = "userId") val userId: String,
    @Json(name = "verifiedKills") val verifiedKills: Int,
    val rank: Int,                              // 1..48 (ignored when disqualified)
    @Json(name = "isDisqualified") val isDisqualified: Boolean = false,
    @Json(name = "disqualifyReason") val disqualifyReason: String? = null,
)

@JsonClass(generateAdapter = true)
data class PayoutRequest(
    val results: List<PayoutResultInput>,
)

/** POST /tournaments/:id/payout response summary. */
@JsonClass(generateAdapter = true)
data class PayoutResponse(
    @Json(name = "tournamentId") val tournamentId: String,
    val status: String,
    @Json(name = "totalPaid") val totalPaid: Double,
    @Json(name = "playersPaid") val playersPaid: Int,
    val breakdown: List<PayoutEntry> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class PayoutEntry(
    @Json(name = "userId") val userId: String,
    @Json(name = "inGameName") val inGameName: String?,
    @Json(name = "verifiedKills") val verifiedKills: Int,
    val rank: Int,
    @Json(name = "rankPrize") val rankPrize: Double,
    @Json(name = "killPrize") val killPrize: Double,
    @Json(name = "totalPrize") val totalPrize: Double,
    @Json(name = "isDisqualified") val isDisqualified: Boolean = false,
)