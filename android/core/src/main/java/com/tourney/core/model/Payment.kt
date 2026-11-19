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

@JsonClass(generateAdapter = true)
data class PaymentPagination(
    val page: Int = 1,
    val limit: Int = 30,
    val total: Int = 0,
    @Json(name = "totalPages") val totalPages: Int = 1,
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
