package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** GET /wallet — balances (Prisma Decimal serialized as strings) + ledger. */
@JsonClass(generateAdapter = true)
data class WalletSummary(
    @Json(name = "tenantId") val tenantId: String,
    @Json(name = "depositBalance") val depositBalance: String,
    @Json(name = "winningBalance") val winningBalance: String,
    @Json(name = "totalBalance") val totalBalance: String,
    val ledger: List<LedgerEntry> = emptyList(),
    val pagination: Pagination = Pagination(),
) {
    val depositValue: Double get() = depositBalance.toDoubleOrNull() ?: 0.0
    val winningValue: Double get() = winningBalance.toDoubleOrNull() ?: 0.0
    val totalValue: Double get() = totalBalance.toDoubleOrNull() ?: 0.0
}

@JsonClass(generateAdapter = true)
data class Pagination(
    val page: Int = 1,
    val limit: Int = 25,
    val total: Int = 0,
)

/** One double-entry ledger row (newest first). */
@JsonClass(generateAdapter = true)
data class LedgerEntry(
    val id: String,
    val amount: String,
    @Json(name = "balanceType") val balanceType: String,  // DEPOSIT | WINNING
    val type: String,                                     // CREDIT | DEBIT
    val category: String,                                 // ADD_MONEY | JOIN_FEE | WINNING_PRIZE | WITHDRAWAL | REFUND
    @Json(name = "balanceAfter") val balanceAfter: String,
    @Json(name = "referenceId") val referenceId: String? = null,
    val notes: String? = null,
    @Json(name = "createdAt") val createdAt: String,
) {
    val amountValue: Double get() = amount.toDoubleOrNull() ?: 0.0
    val isCredit: Boolean get() = type == "CREDIT"

    /** Human label for the category. */
    val categoryLabel: String get() = when (category) {
        "ADD_MONEY" -> "Added Money"
        "JOIN_FEE" -> "Entry Fee"
        "WINNING_PRIZE" -> "Prize Won"
        "WITHDRAWAL" -> "Withdrawal"
        "REFUND" -> "Refund"
        else -> category
    }
}