package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Phase 7: Daily Financial Settlement & Profit Reconciliation.
 * Returned by GET /admin/wallet/settlement?date=YYYY-MM-DD.
 */
@JsonClass(generateAdapter = true)
data class SettlementSummary(
    val date: String,
    @Json(name = "totalDeposits") val totalDeposits: Double = 0.0,
    @Json(name = "depositCount") val depositCount: Int = 0,
    @Json(name = "totalWithdrawals") val totalWithdrawals: Double = 0.0,
    @Json(name = "withdrawalCount") val withdrawalCount: Int = 0,
    @Json(name = "totalMatchRevenue") val totalMatchRevenue: Double = 0.0,
    @Json(name = "matchCount") val matchCount: Int = 0,
    @Json(name = "totalPrizesPaid") val totalPrizesPaid: Double = 0.0,
    @Json(name = "prizeCount") val prizeCount: Int = 0,
    @Json(name = "netOrganizerProfit") val netOrganizerProfit: Double = 0.0,
    @Json(name = "platformCut") val platformCut: Double = 0.0,
    @Json(name = "commissionRate") val commissionRate: Double = 10.0,
)

@JsonClass(generateAdapter = true)
data class SettlementPlayer(
    val id: String,
    val name: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    val phoneNumber: String,
)

@JsonClass(generateAdapter = true)
data class SettlementTransactionRow(
    val id: String,
    val createdAt: String,
    val category: String,
    val type: String,
    val balanceType: String,
    val amount: Double,
    val balanceAfter: Double,
    val referenceId: String? = null,
    val notes: String? = null,
    val player: SettlementPlayer,
)

@JsonClass(generateAdapter = true)
data class DailySettlement(
    val summary: SettlementSummary,
    val transactions: List<SettlementTransactionRow> = emptyList(),
)

/** Request to clone an existing tournament into a fresh UPCOMING match. */
@JsonClass(generateAdapter = true)
data class CloneTournamentRequest(
    @Json(name = "matchTime") val matchTime: String,
    val title: String? = null,
)
