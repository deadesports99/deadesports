package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * GET /admin/players/:id — one player in full: wallet totals, every match they
 * joined (with the identity used at join time), rewards, cheat signals and the
 * other accounts that share their device.
 */
@JsonClass(generateAdapter = true)
data class PlayerDetailResponse(
    val player: AdminPlayerDetailPlayer = AdminPlayerDetailPlayer(),
    val history: PlayerHistory = PlayerHistory(),
    @Json(name = "linkedAccounts") val linkedAccounts: List<LinkedAccount> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class AdminPlayerDetailPlayer(
    val id: String = "",
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
    @Json(name = "deviceId") val deviceId: String? = null,
    @Json(name = "accountAgeDays") val accountAgeDays: Int = 0,
    @Json(name = "totalDeposited") val totalDeposited: String = "0",
    @Json(name = "totalWithdrawn") val totalWithdrawn: String = "0",
    @Json(name = "totalWinnings") val totalWinnings: String = "0",
    @Json(name = "totalSpentOnEntries") val totalSpentOnEntries: String = "0",
) {
    val displayName: String
        get() = playerCode ?: inGameName ?: name ?: phoneNumber

    val depositValue: Double get() = depositBalance.toDoubleOrNull() ?: 0.0
    val winningValue: Double get() = winningBalance.toDoubleOrNull() ?: 0.0
    val depositedValue: Double get() = totalDeposited.toDoubleOrNull() ?: 0.0
    val withdrawnValue: Double get() = totalWithdrawn.toDoubleOrNull() ?: 0.0
    val winningsValue: Double get() = totalWinnings.toDoubleOrNull() ?: 0.0
    val entrySpentValue: Double get() = totalSpentOnEntries.toDoubleOrNull() ?: 0.0

    /** Positive when the player has taken more out than they put in. */
    val netValue: Double get() = withdrawnValue - depositedValue
}

@JsonClass(generateAdapter = true)
data class PlayerHistory(
    val matches: List<PlayerMatchHistory> = emptyList(),
    val summary: PlayerHistorySummary = PlayerHistorySummary(),
)

@JsonClass(generateAdapter = true)
data class PlayerMatchHistory(
    @Json(name = "tournamentId") val tournamentId: String = "",
    @Json(name = "matchNumber") val matchNumber: Int? = null,
    @Json(name = "mapType") val mapType: String = "",
    @Json(name = "matchType") val matchType: String = "",
    val status: String = "",
    @Json(name = "matchTime") val matchTime: String = "",
    @Json(name = "slotNumber") val slotNumber: Int = 0,
    @Json(name = "joinedAt") val joinedAt: String? = null,
    @Json(name = "inGameNameAtJoin") val inGameNameAtJoin: String? = null,
    @Json(name = "inGameUidAtJoin") val inGameUidAtJoin: String? = null,
    val rank: Int? = null,
    val kills: Int = 0,
    @Json(name = "prizeWon") val prizeWon: String = "0",
    @Json(name = "isPaid") val isPaid: Boolean = false,
    @Json(name = "isDisqualified") val isDisqualified: Boolean = false,
    @Json(name = "disqualifyReason") val disqualifyReason: String? = null,
    @Json(name = "bannedFromMatch") val bannedFromMatch: Boolean = false,
    @Json(name = "sharedDeviceInMatch") val sharedDeviceInMatch: Boolean = false,
) {
    val prizeValue: Double get() = prizeWon.toDoubleOrNull() ?: 0.0

    /** "50 | Bermuda • Solo" — same identity format as the rest of the app. */
    val displayName: String
        get() = buildString {
            if (matchNumber != null) {
                append(matchNumber)
                append(" | ")
            }
            append(mapType.lowercase().replaceFirstChar { it.uppercase() })
            append(" • ")
            append(matchType.lowercase().replaceFirstChar { it.uppercase() })
        }
}

@JsonClass(generateAdapter = true)
data class PlayerHistorySummary(
    val totalMatches: Int = 0,
    val completedMatches: Int = 0,
    val totalKills: Int = 0,
    @Json(name = "totalWon") val totalWon: String = "0",
    val booyahs: Int = 0,
    val disqualifications: Int = 0,
    @Json(name = "matchBans") val matchBans: Int = 0,
    @Json(name = "sharedDeviceMatches") val sharedDeviceMatches: Int = 0,
    @Json(name = "avgKills") val avgKills: Double = 0.0,
    @Json(name = "winRatePct") val winRatePct: Double = 0.0,
) {
    val totalWonValue: Double get() = totalWon.toDoubleOrNull() ?: 0.0
}

@JsonClass(generateAdapter = true)
data class LinkedAccount(
    @Json(name = "userId") val userId: String = "",
    @Json(name = "playerCode") val playerCode: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    @Json(name = "isBanned") val isBanned: Boolean = false,
    @Json(name = "sharedMatches") val sharedMatches: Int = 0,
) {
    val displayName: String get() = playerCode ?: inGameName ?: userId.take(8)
}
