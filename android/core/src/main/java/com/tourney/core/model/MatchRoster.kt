package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Phase 12 — Match roster: who is in the match, their reward, cheat flags & ban.
 * Backed by GET /admin/matches/:id/participants.
 */

@JsonClass(generateAdapter = true)
data class MatchRosterResponse(
    val match: RosterMatchInfo = RosterMatchInfo(),
    @Json(name = "prizeRules") val prizeRules: PrizeRules = PrizeRules(),
    val participants: List<MatchParticipant> = emptyList(),
    val summary: RosterSummary = RosterSummary(),
)

@JsonClass(generateAdapter = true)
data class RosterMatchInfo(
    val id: String = "",
    @Json(name = "matchNumber") val matchNumber: Int? = null,
    val title: String = "",
    @Json(name = "mapType") val mapType: String = "",
    @Json(name = "matchType") val matchType: String = "",
    val status: String = "",
    @Json(name = "matchTime") val matchTime: String = "",
    @Json(name = "entryFee") val entryFee: String = "0",
    @Json(name = "prizePool") val prizePool: String = "0",
    @Json(name = "perKillPrize") val perKillPrize: String = "0",
    @Json(name = "totalSlots") val totalSlots: Int = 0,
    @Json(name = "slotsBooked") val slotsBooked: Int = 0,
)

@JsonClass(generateAdapter = true)
data class PrizeRules(
    @Json(name = "1") val rank1: Double = 0.5,
    @Json(name = "2") val rank2: Double = 0.3,
    @Json(name = "3") val rank3: Double = 0.2,
) {
    fun shareOf(rank: Int?): Double = when (rank) {
        1 -> rank1
        2 -> rank2
        3 -> rank3
        else -> 0.0
    }
}

@JsonClass(generateAdapter = true)
data class MatchParticipant(
    @Json(name = "slotId") val slotId: String = "",
    @Json(name = "slotNumber") val slotNumber: Int = 0,
    @Json(name = "teamId") val teamId: String? = null,
    @Json(name = "userId") val userId: String = "",
    @Json(name = "playerCode") val playerCode: String? = null,
    val name: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    @Json(name = "inGameUid") val inGameUid: String? = null,
    @Json(name = "phoneNumber") val phoneNumber: String = "",
    @Json(name = "joinedAt") val joinedAt: String? = null,
    @Json(name = "isBanned") val isBanned: Boolean = false,
    @Json(name = "banReason") val banReason: String? = null,
    @Json(name = "accountBanned") val accountBanned: Boolean = false,
    val result: ParticipantResult? = null,
    val flags: List<ParticipantFlag> = emptyList(),
) {
    val isAccountBannedOrMatchBanned: Boolean get() = isBanned || accountBanned

    val displayName: String
        get() = playerCode ?: inGameName ?: name ?: phoneNumber
}

@JsonClass(generateAdapter = true)
data class ParticipantResult(
    val rank: Int? = null,
    @Json(name = "verifiedKills") val verifiedKills: Int = 0,
    @Json(name = "prizeWon") val prizeWon: String = "0",
    @Json(name = "isApproved") val isApproved: Boolean = false,
    @Json(name = "isDisqualified") val isDisqualified: Boolean = false,
    @Json(name = "disqualifyReason") val disqualifyReason: String? = null,
) {
    val prizeValue: Double get() = prizeWon.toDoubleOrNull() ?: 0.0
}

@JsonClass(generateAdapter = true)
data class ParticipantFlag(
    val code: String = "",
    val detail: String = "",
)

@JsonClass(generateAdapter = true)
data class RosterSummary(
    val total: Int = 0,
    val flagged: Int = 0,
    @Json(name = "noUid") val noUid: Int = 0,
    val banned: Int = 0,
    val paid: Int = 0,
    @Json(name = "totalEntryCollected") val totalEntryCollected: String = "0",
    @Json(name = "totalPrizePaid") val totalPrizePaid: String = "0",
)

// ─── POST /admin/matches/:id/payout ─────────────────────────────────────
@JsonClass(generateAdapter = true)
data class AwardRequest(
    @Json(name = "userId") val userId: String,
    val rank: Int? = null,
    val kills: Int = 0,
    val amount: Double? = null,
    @Json(name = "isDisqualified") val isDisqualified: Boolean = false,
    @Json(name = "disqualifyReason") val disqualifyReason: String? = null,
)

@JsonClass(generateAdapter = true)
data class PayoutAwardsRequest(
    val awards: List<AwardRequest>,
    @Json(name = "completeMatch") val completeMatch: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class PayoutAwardsResponse(
    @Json(name = "tournamentId") val tournamentId: String = "",
    val status: String = "",
    @Json(name = "totalPaid") val totalPaid: Double = 0.0,
    @Json(name = "playersPaid") val playersPaid: Int = 0,
    val skipped: List<SkippedAward> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class SkippedAward(
    @Json(name = "userId") val userId: String = "",
    val reason: String = "",
)

// ─── PATCH /admin/matches/:id/participants/:userId/ban ──────────────────
@JsonClass(generateAdapter = true)
data class ParticipantBanRequest(
    @Json(name = "isBanned") val isBanned: Boolean,
    val reason: String? = null,
    @Json(name = "banAccount") val banAccount: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class ParticipantBanResponse(
    @Json(name = "tournamentId") val tournamentId: String = "",
    @Json(name = "userId") val userId: String = "",
    @Json(name = "matchBanned") val matchBanned: Boolean = false,
    @Json(name = "accountBanned") val accountBanned: Boolean = false,
    @Json(name = "banReason") val banReason: String? = null,
)
