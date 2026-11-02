package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ─── FCM push token (POST /auth/fcm-token) ───────────────────────────────
@JsonClass(generateAdapter = true)
data class FcmTokenRequest(
    val token: String,
)

@JsonClass(generateAdapter = true)
data class FcmTokenResponse(
    val registered: Boolean,
)

// ─── Player withdrawal (POST /wallet/withdraw) ───────────────────────────
@JsonClass(generateAdapter = true)
data class WithdrawRequest(
    val amount: Double,
    @Json(name = "upiId") val upiId: String,
    @Json(name = "deviceId") val deviceId: String? = null,
)

@JsonClass(generateAdapter = true)
data class WithdrawResponse(
    val withdrawal: WithdrawalItem,
    @Json(name = "winningBalance") val winningBalance: String,
)

@JsonClass(generateAdapter = true)
data class WithdrawalItem(
    val id: String,
    val amount: String,
    @Json(name = "upiId") val upiId: String,
    val status: String,          // PENDING | APPROVED | REJECTED
    @Json(name = "deviceId") val deviceId: String? = null,
    @Json(name = "utrNumber") val utrNumber: String? = null,
    @Json(name = "rejectionNote") val rejectionNote: String? = null,
    @Json(name = "createdAt") val createdAt: String,
)

// ─── Admin wallet console (GET /admin/wallet/withdrawals) ────────────────
@JsonClass(generateAdapter = true)
data class WithdrawalsResponse(
    val withdrawals: List<AdminWithdrawal> = emptyList(),
    val count: Int = 0,
)

@JsonClass(generateAdapter = true)
data class AdminWithdrawal(
    val id: String,
    val amount: String,
    @Json(name = "upiId") val upiId: String,
    val status: String,
    @Json(name = "deviceId") val deviceId: String? = null,
    @Json(name = "utrNumber") val utrNumber: String? = null,
    @Json(name = "rejectionNote") val rejectionNote: String? = null,
    @Json(name = "createdAt") val createdAt: String,
    val player: AdminWithdrawalPlayer,
) {
    val amountValue: Double get() = amount.toDoubleOrNull() ?: 0.0
}

@JsonClass(generateAdapter = true)
data class AdminWithdrawalPlayer(
    val id: String,
    @Json(name = "inGameName") val inGameName: String?,
    @Json(name = "inGameUid") val inGameUid: String?,
    @Json(name = "phoneNumber") val phoneNumber: String,
)

@JsonClass(generateAdapter = true)
data class ApproveWithdrawalRequest(
    @Json(name = "utrNumber") val utrNumber: String,
)

@JsonClass(generateAdapter = true)
data class RejectWithdrawalRequest(
    val reason: String,
)