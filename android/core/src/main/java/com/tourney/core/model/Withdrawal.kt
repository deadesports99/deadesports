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

