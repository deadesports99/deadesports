package com.tourney.core.payment

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.tourney.core.model.ApiException
import com.tourney.core.model.PaymentGatewayInfo
import com.tourney.core.model.PaymentOrderCreated
import com.tourney.core.model.PaymentOrderStatus
import com.tourney.core.model.VerifyPaymentRequest
import com.tourney.core.model.VerifyPaymentResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Gateway calls the top-up flow needs. Kept as an interface so it can be faked in tests. */
interface PaymentOrdersApi {
    suspend fun createOrder(amountPaise: Int): PaymentOrderCreated
    suspend fun verify(request: VerifyPaymentRequest): VerifyPaymentResponse
    suspend fun order(orderId: String): PaymentOrderStatus
    suspend fun sync(orderId: String): VerifyPaymentResponse
    suspend fun gatewayInfo(): PaymentGatewayInfo
}

/**
 * Online wallet top-up state machine (framework-free).
 *
 * Owns the four states the Add Money sheet draws — order, message, busy, settled —
 * and every rule that protects money:
 *  - one order at a time (double-tapping Pay cannot create two orders),
 *  - a blank SDK signature falls back to the server reconcile path,
 *  - "Check status" is idempotent: the backend settles at most once,
 *  - the wallet is refreshed only when the money is actually CAPTURED.
 *
 * No Android imports, so the whole flow is unit-testable without Robolectric.
 */
class TopUpController(
    private val scope: CoroutineScope,
    private val orders: PaymentOrdersApi,
    /** Called once when money lands, with the amount in rupees (wallet + history refresh). */
    private val onSettled: (amountRupees: Int) -> Unit = {},
    private val minAmountPaise: Int = MIN_TOP_UP_PAISE,
) {
    /** Last created order — survives the checkout round-trip. */
    var activeOrder by mutableStateOf<PaymentOrderCreated?>(null)
        private set

    /** Inline status line shown inside the Add Money sheet. */
    var message by mutableStateOf<String?>(null)
        private set

    /** True while creating / verifying / reconciling an order. */
    var isBusy by mutableStateOf(false)
        private set

    /** True once the money is confirmed in the wallet. */
    var isSettled by mutableStateOf(false)
        private set

    /** Public gateway info (provider + limits + demo flag). */
    var gatewayInfo by mutableStateOf<PaymentGatewayInfo?>(null)
        private set

    fun loadGatewayInfo() {
        if (gatewayInfo != null) return
        scope.launch {
            try {
                gatewayInfo = orders.gatewayInfo()
            } catch (_: Exception) {
                // Non-fatal: the sheet falls back to tenant/bundled limits.
            }
        }
    }

    fun clear() {
        activeOrder = null
        message = null
        isBusy = false
        isSettled = false
    }

    /**
     * Create a gateway order and hand it to the caller, which opens the checkout
     * (native SDK, or the mock checkout page in demo mode).
     */
    fun start(amountRupees: Int, onReady: (PaymentOrderCreated) -> Unit) {
        if (isBusy) return
        val amountPaise = amountRupees * 100
        if (amountPaise < minAmountPaise) {
            message = "Minimum top-up is ₹${minAmountPaise / 100}."
            return
        }
        isBusy = true
        message = null
        isSettled = false
        scope.launch {
            try {
                val order = orders.createOrder(amountPaise)
                activeOrder = order
                onReady(order)
            } catch (e: ApiException) {
                message = e.message
            } catch (_: Exception) {
                message = "Could not start the payment. Check your connection."
            } finally {
                isBusy = false
            }
        }
    }

    /** SDK success callback. A missing signature means "ask the server instead". */
    fun onGatewaySuccess(paymentId: String, signature: String?) {
        val order = activeOrder ?: return
        if (signature.isNullOrBlank()) {
            // Older SDK builds omit the signature — reconcile through the backend.
            sync()
            return
        }
        if (isBusy) return
        isBusy = true
        message = "Verifying payment…"
        scope.launch {
            try {
                val result = orders.verify(
                    VerifyPaymentRequest(orderId = order.orderId, paymentId = paymentId, signature = signature),
                )
                if (result.isCaptured) settle(order.amountRupees)
                else message = "Gateway has not captured this payment yet. Tap Check status."
            } catch (e: ApiException) {
                message = e.message
            } catch (_: Exception) {
                message = "Payment verification failed. Tap Check status to retry."
            } finally {
                isBusy = false
            }
        }
    }

    /** SDK failure / user-cancelled checkout. */
    fun onGatewayError(reason: String?) {
        message = reason?.takeIf { it.isNotBlank() } ?: "Payment cancelled."
    }

    /**
     * Ask the server — and for Razorpay the gateway itself — whether the order was
     * paid. Safe to tap repeatedly: server-side settlement is idempotent.
     */
    fun sync() {
        val order = activeOrder ?: return
        syncOrder(order.orderId, order.amountRupees)
    }

    /**
     * Re-check one order from the history list (Add Money may already be closed).
     * Same idempotent server path, same messages.
     */
    fun recheck(orderId: String, amountRupees: Int) {
        syncOrder(orderId, amountRupees)
    }

    private fun syncOrder(orderId: String, amountRupees: Int) {
        if (isBusy) return
        isBusy = true
        message = "Checking payment status…"
        scope.launch {
            try {
                val local = orders.order(orderId)
                if (local.isCaptured) {
                    settle(amountRupees)
                    return@launch
                }

                val synced = orders.sync(orderId)
                if (synced.isCaptured) {
                    settle(amountRupees)
                } else {
                    message = when (local.status) {
                        "PENDING" -> "Payment is still pending at the gateway. Try again in a minute."
                        "FAILED" -> "Payment failed. You can try again."
                        "EXPIRED" -> "This checkout expired. Create a new order."
                        else -> "No payment received yet. Finish the checkout, then tap Check status."
                    }
                }
            } catch (e: ApiException) {
                message = e.message
            } catch (_: Exception) {
                message = "Could not check the payment. Try again."
            } finally {
                isBusy = false
            }
        }
    }

    private fun settle(rupees: Int) {
        isSettled = true
        message = "✅ ₹$rupees added to your wallet."
        activeOrder = null
        onSettled(rupees)
    }

    companion object {
        const val MIN_TOP_UP_PAISE = 100
    }
}
