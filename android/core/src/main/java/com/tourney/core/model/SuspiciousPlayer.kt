package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * GET /admin/players/suspicious — accounts ranked by how much they look like a
 * problem. Nothing here is a verdict: each row is a hint the owner opens and
 * decides on. Every signal carries its own weight and a readable reason.
 */
@JsonClass(generateAdapter = true)
data class SuspiciousPlayersResponse(
    val rows: List<SuspiciousPlayer> = emptyList(),
    val scannedUsers: Int = 0,
    val minScore: Int = 30,
)

@JsonClass(generateAdapter = true)
data class SuspiciousPlayer(
    @Json(name = "userId") val userId: String = "",
    @Json(name = "playerCode") val playerCode: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    val name: String? = null,
    @Json(name = "phoneNumber") val phoneNumber: String = "",
    @Json(name = "inGameUid") val inGameUid: String? = null,
    @Json(name = "deviceId") val deviceId: String? = null,
    @Json(name = "isBanned") val isBanned: Boolean = false,
    val score: Int = 0,
    val signals: List<SuspicionSignal> = emptyList(),
    val stats: SuspicionStats = SuspicionStats(),
) {
    val displayName: String get() = playerCode ?: inGameName ?: name ?: phoneNumber

    /** 70+ is worth acting on, 40-69 worth opening, below that just noise. */
    val severity: Severity
        get() = when {
            score >= 70 -> Severity.HIGH
            score >= 40 -> Severity.MEDIUM
            else -> Severity.LOW
        }
}

enum class Severity { HIGH, MEDIUM, LOW }

@JsonClass(generateAdapter = true)
data class SuspicionSignal(
    val code: String = "",
    val label: String = "",
    val detail: String = "",
    val weight: Int = 0,
)

@JsonClass(generateAdapter = true)
data class SuspicionStats(
    val matchesJoined: Int = 0,
    val completedMatches: Int = 0,
    @Json(name = "totalWinnings") val totalWinnings: Double = 0.0,
    @Json(name = "totalDeposited") val totalDeposited: Double = 0.0,
    @Json(name = "totalWithdrawn") val totalWithdrawn: Double = 0.0,
    @Json(name = "netOut") val netOut: Double = 0.0,
    @Json(name = "winRatePct") val winRatePct: Double = 0.0,
    @Json(name = "avgKills") val avgKills: Double = 0.0,
    @Json(name = "recentAvgKills") val recentAvgKills: Double = 0.0,
    @Json(name = "earlierAvgKills") val earlierAvgKills: Double = 0.0,
    @Json(name = "accountsOnDevice") val accountsOnDevice: Int = 1,
)
