package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Online payment gateway models (backend: /api/payments).
 *
 * Amounts are integers in PAISE end-to-end. The client never does float money
 * math: it sends `amountPaise` and displays `amountPaise / 100`.
 */

/** POST /payments/orders — request body. */
@JsonClass(generateAdapter = true)
data class CreatePaymentOrderRequest(
    @Json(name = "amountPaise") val amountPaise: Int,
)

/** POST /payments/orders — created gateway order. */
@JsonClass(generateAdapter = true)
data class PaymentOrderCreated(
    val orderId: String,
    val provider: String,
    val providerOrderId: String,
    val amountPaise: Int,
    val currency: String = "INR",
    /** Publishable key for the native Razorpay checkout (null in mock mode). */
    val keyId: String? = null,
    /** Browser checkout URL (mock mode only). */
    val checkoutUrl: String? = null,
    val expiresAt: String? = null,
) {
    val amountRupees: Int get() = amountPaise / 100
    val isRazorpay: Boolean get() = provider == "razorpay" && !keyId.isNullOrBlank()
}

/** GET /payments/orders/{id} — server-side truth for one order. */
@JsonClass(generateAdapter = true)
data class PaymentOrderStatus(
    val orderId: String,
    val status: String,
    val amountPaise: Int,
    val currency: String = "INR",
    val provider: String = "mock",
    val createdAt: String? = null,
    val capturedAt: String? = null,
    val failureReason: String? = null,
) {
    val isCaptured: Boolean get() = status == "CAPTURED"
}

/** POST /payments/verify — checkout handshake from the native SDK. */
@JsonClass(generateAdapter = true)
data class VerifyPaymentRequest(
    val orderId: String,
    val paymentId: String,
    val signature: String,
)

/** GET /payments/config — public gateway info (provider, limits, demo flag). */
@JsonClass(generateAdapter = true)
data class PaymentGatewayInfo(
    val provider: String = "mock",
    val currency: String = "INR",
    val minAmountPaise: Int = 1000,
    val maxAmountPaise: Int = 1_000_000,
    val demoMode: Boolean = true,
) {
    val minAmountRupees: Int get() = minAmountPaise / 100
    val maxAmountRupees: Int get() = maxAmountPaise / 100
}

/** POST /payments/verify and /payments/orders/{id}/sync — settlement result. */
@JsonClass(generateAdapter = true)
data class VerifyPaymentResponse(
    val orderId: String,
    val status: String,
    val alreadySettled: Boolean = false,
    val balanceAfter: Double? = null,
    val gatewayStatus: String? = null,
) {
    val isCaptured: Boolean get() = status == "CAPTURED"
}

/** Player info shown on an admin payment row. */
@JsonClass(generateAdapter = true)
data class PaymentPlayer(
    val id: String = "",
    val name: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    @Json(name = "inGameUid") val inGameUid: String? = null,
    @Json(name = "phoneNumber") val phoneNumber: String = "",
) {
    /** Best label for the admin list. */
    val label: String get() = inGameName?.takeIf { it.isNotBlank() } ?: name?.takeIf { it.isNotBlank() } ?: "Unknown player"
}

/** One online payment order in the admin console. */
@JsonClass(generateAdapter = true)
data class AdminPaymentOrder(
    val id: String,
    @Json(name = "amountPaise") val amountPaise: Int = 0,
    @Json(name = "amountRupees") val amountRupees: Double = 0.0,
    val currency: String = "INR",
    val provider: String = "mock",
    val status: String = "CREATED",
    @Json(name = "providerOrderId") val providerOrderId: String? = null,
    @Json(name = "providerPaymentId") val providerPaymentId: String? = null,
    @Json(name = "failureReason") val failureReason: String? = null,
    @Json(name = "createdAt") val createdAt: String = "",
    @Json(name = "capturedAt") val capturedAt: String? = null,
    val player: PaymentPlayer = PaymentPlayer(),
) {
    val isDemo: Boolean get() = provider == "mock"
    val needsAttention: Boolean get() = status == "CREATED" || status == "PENDING" || status == "EXPIRED"
}

/** Money summary shown above the admin online-payments list. */
@JsonClass(generateAdapter = true)
data class PaymentMoneySummary(
    @Json(name = "collectedTodayRupees") val collectedTodayRupees: Double = 0.0,
    @Json(name = "collectedTotalRupees") val collectedTotalRupees: Double = 0.0,
    @Json(name = "capturedCount") val capturedCount: Int = 0,
    @Json(name = "pendingCount") val pendingCount: Int = 0,
    @Json(name = "failedCount") val failedCount: Int = 0,
    @Json(name = "demoMode") val demoMode: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class PaymentPagination(
    val page: Int = 1,
    val limit: Int = 30,
    val total: Int = 0,
    @Json(name = "totalPages") val totalPages: Int = 1,
)

@JsonClass(generateAdapter = true)
data class AdminPaymentsResponse(
    val payments: List<AdminPaymentOrder> = emptyList(),
    val summary: PaymentMoneySummary = PaymentMoneySummary(),
    val pagination: PaymentPagination = PaymentPagination(),
)

/** POST /admin/wallet/payments/{id}/sync result. */
@JsonClass(generateAdapter = true)
data class ReconcilePaymentResponse(
    @Json(name = "orderId") val orderId: String = "",
    val status: String = "",
    @Json(name = "gatewayStatus") val gatewayStatus: String? = null,
    @Json(name = "alreadySettled") val alreadySettled: Boolean = false,
    @Json(name = "balanceAfter") val balanceAfter: Double? = null,
    @Json(name = "creditedPaise") val creditedPaise: Int? = null,
)

/** One row of GET /payments/my — the player's own top-up history. */
@JsonClass(generateAdapter = true)
data class PlayerPayment(
    val id: String = "",
    val amountPaise: Int = 0,
    val amountRupees: Double = 0.0,
    val currency: String = "INR",
    val provider: String = "mock",
    val status: String = "CREATED",
    val providerOrderId: String? = null,
    val providerPaymentId: String? = null,
    val failureReason: String? = null,
    val createdAt: String = "",
    val capturedAt: String? = null,
    val expiresAt: String? = null,
) {
    val isCaptured: Boolean get() = status == "CAPTURED"

    /** Still waiting on the gateway — worth a "Re-check". */
    val isPending: Boolean get() = status in setOf("CREATED", "PENDING", "AUTHORIZED")

    /** One line the player can understand without support. */
    val label: String
        get() = when (status) {
            "CAPTURED" -> "Paid"
            "CREATED", "PENDING", "AUTHORIZED" -> "Pending"
            "FAILED" -> "Failed"
            "EXPIRED" -> "Expired"
            else -> status
        }
}

/** GET /payments/my response envelope data. */
@JsonClass(generateAdapter = true)
data class PlayerPaymentsResponse(
    val items: List<PlayerPayment> = emptyList(),
    val pagination: PaymentPagination = PaymentPagination(),
    val demoMode: Boolean = false,
)
