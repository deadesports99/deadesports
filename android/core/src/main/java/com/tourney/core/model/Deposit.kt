package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ─── Player: Add Cash via UPI (amount + UTR proof) ───────────────────────
// POST /wallet/deposit  { amount, utrNumber }  -> PENDING request
// GET  /wallet/deposits -> own request history (status chips in the modal)

/** UTR / RRN: exactly 12 letters or digits (backend-regex parity). */
val UTR_REGEX = Regex("^[A-Za-z0-9]{12}$")

@JsonClass(generateAdapter = true)
data class SubmitDepositRequest(
    val amount: Double,
    @Json(name = "utrNumber") val utrNumber: String,
)

@JsonClass(generateAdapter = true)
data class DepositItem(
    val id: String,
    val amount: String,
    @Json(name = "utrNumber") val utrNumber: String,
    val status: String,                       // PENDING | APPROVED | REJECTED
    @Json(name = "rejectionNote") val rejectionNote: String? = null,
    @Json(name = "createdAt") val createdAt: String,
    @Json(name = "reviewedAt") val reviewedAt: String? = null,
) {
    val amountValue: Double get() = amount.toDoubleOrNull() ?: 0.0

    val statusLabel: String get() = when (status) {
        "APPROVED" -> "✅ Credited"
        "REJECTED" -> "❌ Rejected"
        else -> "⏳ Pending review"
    }
}

@JsonClass(generateAdapter = true)
data class DepositSubmitResponse(
    val deposit: DepositItem,
    val message: String = "",
)

@JsonClass(generateAdapter = true)
data class PlayerDepositsResponse(
    val deposits: List<DepositItem> = emptyList(),
    val count: Int = 0,
    @Json(name = "pendingAmount") val pendingAmount: String = "0.00",
) {
    val pendingValue: Double get() = pendingAmount.toDoubleOrNull() ?: 0.0
}

// ─── Admin: deposit verification console ─────────────────────────────────
// GET  /admin/wallet/deposits            -> queue (status filter)
// POST /admin/wallet/deposits/:id/approve -> credit depositBalance
// POST /admin/wallet/deposits/:id/reject  -> reject with reason

@JsonClass(generateAdapter = true)
data class AdminDeposit(
    val id: String,
    val amount: String,
    @Json(name = "utrNumber") val utrNumber: String,
    val status: String,
    @Json(name = "rejectionNote") val rejectionNote: String? = null,
    @Json(name = "createdAt") val createdAt: String,
    @Json(name = "reviewedAt") val reviewedAt: String? = null,
    val player: AdminWithdrawalPlayer,
) {
    val amountValue: Double get() = amount.toDoubleOrNull() ?: 0.0
}

@JsonClass(generateAdapter = true)
data class AdminDepositsResponse(
    val deposits: List<AdminDeposit> = emptyList(),
    val count: Int = 0,
    @Json(name = "pendingTotal") val pendingTotal: String = "0.00",
)

@JsonClass(generateAdapter = true)
data class DepositActionResponse(
    val message: String = "",
    val deposit: DepositItem? = null,
    @Json(name = "depositBalance") val depositBalance: String? = null,
)

/** Body for endpoints that take no meaningful payload (approve-deposit). */
@JsonClass(generateAdapter = true)
data class AckRequest(val confirm: Boolean = true)
