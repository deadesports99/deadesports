package com.tourney.core.payment

import com.tourney.core.model.ApiException
import com.tourney.core.model.PaymentGatewayInfo
import com.tourney.core.model.PaymentOrderCreated
import com.tourney.core.model.PaymentOrderStatus
import com.tourney.core.model.VerifyPaymentRequest
import com.tourney.core.model.VerifyPaymentResponse
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * The player's top-up flow, tested without Android or a network.
 * Every rule here has cost money before: double orders, silent failures,
 * refreshing the wallet before the gateway captured anything.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TopUpControllerTest {

    // ── fakes ──────────────────────────────────────────────────────────────
    private class FakeApi : PaymentOrdersApi {
        var createCalls = 0
        var verifyCalls = 0
        var syncCalls = 0
        var statusCalls = 0
        var createError: Exception? = null
        var verifyError: Exception? = null
        var status = "PENDING"
        var syncStatus = "PENDING"
        var verifyResponse = VerifyPaymentResponse(orderId = "o1", status = "CAPTURED", balanceAfter = 500.0)
        val verifyRequests = mutableListOf<VerifyPaymentRequest>()

        override suspend fun createOrder(amountPaise: Int): PaymentOrderCreated {
            createCalls += 1
            createError?.let { throw it }
            return PaymentOrderCreated(
                orderId = "o1",
                provider = "razorpay",
                providerOrderId = "order_RZP1",
                amountPaise = amountPaise,
                keyId = "rzp_test_x",
            )
        }

        override suspend fun verify(request: VerifyPaymentRequest): VerifyPaymentResponse {
            verifyCalls += 1
            verifyRequests += request
            verifyError?.let { throw it }
            return verifyResponse
        }

        override suspend fun order(orderId: String): PaymentOrderStatus {
            statusCalls += 1
            return PaymentOrderStatus(orderId = orderId, status = status, amountPaise = 50_000)
        }

        override suspend fun sync(orderId: String): VerifyPaymentResponse {
            syncCalls += 1
            return VerifyPaymentResponse(orderId = orderId, status = syncStatus)
        }

        override suspend fun gatewayInfo(): PaymentGatewayInfo =
            PaymentGatewayInfo(provider = "razorpay", minAmountPaise = 1_000, maxAmountPaise = 100_000, demoMode = false)
    }

    private fun TestScope.controller(
        api: FakeApi,
        settled: MutableList<Int> = mutableListOf(),
        minAmountPaise: Int = 100,
    ): TopUpController = TopUpController(
        scope = this,
        orders = api,
        onSettled = { rupees -> settled += rupees },
        minAmountPaise = minAmountPaise,
    )

    // ── order creation ─────────────────────────────────────────────────────
    @Test
    fun `creates one order in paise and hands it to the checkout`() = runTest {
        val api = FakeApi()
        val vm = controller(api)
        var ready: PaymentOrderCreated? = null

        vm.start(amountRupees = 500) { ready = it }
        advanceUntilIdle()

        assertEquals(1, api.createCalls)
        assertEquals("o1", ready?.orderId)
        assertEquals("order_RZP1", vm.activeOrder?.providerOrderId)
        assertEquals(50_000, vm.activeOrder?.amountPaise)
        assertFalse(vm.isBusy)
        assertNull(vm.message)
    }

    @Test
    fun `a second tap while busy never creates a second order`() = runTest {
        val api = FakeApi()
        val vm = controller(api)
        var readyCount = 0

        vm.start(amountRupees = 500) { readyCount += 1 }
        vm.start(amountRupees = 500) { readyCount += 1 } // double tap
        advanceUntilIdle()

        assertEquals(1, api.createCalls)
        assertEquals(1, readyCount)
    }

    @Test
    fun `an amount below the minimum is refused before any network call`() = runTest {
        val api = FakeApi()
        val vm = controller(api, minAmountPaise = 1_000)

        vm.start(amountRupees = 5) { fail("checkout must not open") }
        advanceUntilIdle()

        assertEquals(0, api.createCalls)
        assertEquals("Minimum top-up is ₹10.", vm.message)
        assertFalse(vm.isBusy)
    }

    @Test
    fun `a gateway failure shows the server message and leaves no order`() = runTest {
        val api = FakeApi().apply { createError = ApiException(502, "Payment gateway rejected the request: amount is invalid") }
        val vm = controller(api)

        vm.start(amountRupees = 500) { fail("checkout must not open") }
        advanceUntilIdle()

        assertEquals("Payment gateway rejected the request: amount is invalid", vm.message)
        assertNull(vm.activeOrder)
        assertFalse(vm.isBusy)
    }

    @Test
    fun `a network crash becomes a friendly message, not a stuck spinner`() = runTest {
        val api = FakeApi().apply { createError = IllegalStateException("socket closed") }
        val vm = controller(api)

        vm.start(amountRupees = 500) { fail("checkout must not open") }
        advanceUntilIdle()

        assertEquals("Could not start the payment. Check your connection.", vm.message)
        assertFalse(vm.isBusy)
    }

    // ── checkout handoff ───────────────────────────────────────────────────
    @Test
    fun `a captured verification settles once and refreshes the wallet`() = runTest {
        val api = FakeApi()
        val settled = mutableListOf<Int>()
        val vm = controller(api, settled)
        vm.start(amountRupees = 500) {}
        advanceUntilIdle()

        vm.onGatewaySuccess(paymentId = "pay_1", signature = "sig")
        advanceUntilIdle()

        assertEquals(1, api.verifyCalls)
        assertEquals("o1", api.verifyRequests.single().orderId)
        assertEquals("pay_1", api.verifyRequests.single().paymentId)
        assertTrue(vm.isSettled)
        assertEquals("✅ ₹500 added to your wallet.", vm.message)
        assertNull(vm.activeOrder)
        assertEquals(listOf(500), settled)
    }

    @Test
    fun `an uncaptured verification keeps the order for Check status`() = runTest {
        val api = FakeApi().apply {
            verifyResponse = VerifyPaymentResponse(orderId = "o1", status = "AUTHORIZED")
        }
        val settled = mutableListOf<Int>()
        val vm = controller(api, settled)
        vm.start(amountRupees = 500) {}
        advanceUntilIdle()

        vm.onGatewaySuccess(paymentId = "pay_1", signature = "sig")
        advanceUntilIdle()

        assertFalse(vm.isSettled)
        assertEquals("Gateway has not captured this payment yet. Tap Check status.", vm.message)
        assertEquals("o1", vm.activeOrder?.orderId)
        assertTrue(settled.isEmpty())
    }

    @Test
    fun `a missing signature reconciles through the server instead of failing`() = runTest {
        val api = FakeApi().apply { syncStatus = "CAPTURED" }
        val vm = controller(api)
        vm.start(amountRupees = 500) {}
        advanceUntilIdle()

        vm.onGatewaySuccess(paymentId = "pay_1", signature = null)
        advanceUntilIdle()

        assertEquals(0, api.verifyCalls)
        assertEquals(1, api.statusCalls)
        assertEquals(1, api.syncCalls)
        assertTrue(vm.isSettled)
    }

    @Test
    fun `a verify error keeps the money pending and explains why`() = runTest {
        val api = FakeApi().apply { verifyError = ApiException(400, "Invalid signature") }
        val settled = mutableListOf<Int>()
        val vm = controller(api, settled)
        vm.start(amountRupees = 500) {}
        advanceUntilIdle()

        vm.onGatewaySuccess(paymentId = "pay_1", signature = "bad")
        advanceUntilIdle()

        assertEquals("Invalid signature", vm.message)
        assertFalse(vm.isSettled)
        assertTrue(settled.isEmpty())
        assertFalse(vm.isBusy)
    }

    @Test
    fun `cancelling the checkout says so and never touches the wallet`() = runTest {
        val api = FakeApi()
        val vm = controller(api)
        vm.start(amountRupees = 500) {}
        advanceUntilIdle()

        vm.onGatewayError(null)
        assertEquals("Payment cancelled.", vm.message)

        vm.onGatewayError("Payment failed at bank")
        assertEquals("Payment failed at bank", vm.message)
        assertFalse(vm.isSettled)
    }

    // ── Check status (reconcile) ───────────────────────────────────────────
    @Test
    fun `Check status settles when the server already captured it`() = runTest {
        val api = FakeApi().apply { status = "CAPTURED" }
        val settled = mutableListOf<Int>()
        val vm = controller(api, settled)
        vm.start(amountRupees = 500) {}
        advanceUntilIdle()

        vm.sync()
        advanceUntilIdle()

        assertTrue(vm.isSettled)
        assertEquals("no gateway round-trip needed when the server already knows", 0, api.syncCalls)
        assertEquals(listOf(500), settled)
    }

    @Test
    fun `Check status asks the gateway and settles a late capture`() = runTest {
        val api = FakeApi().apply { status = "PENDING"; syncStatus = "CAPTURED" }
        val vm = controller(api)
        vm.start(amountRupees = 500) {}
        advanceUntilIdle()

        vm.sync()
        advanceUntilIdle()

        assertEquals(1, api.syncCalls)
        assertTrue(vm.isSettled)
    }

    @Test
    fun `Check status explains every still-unpaid state`() = runTest {
        val cases = mapOf(
            "PENDING" to "Payment is still pending at the gateway. Try again in a minute.",
            "FAILED" to "Payment failed. You can try again.",
            "EXPIRED" to "This checkout expired. Create a new order.",
        )

        cases.forEach { (status, expected) ->
            val api = FakeApi().apply { this.status = status; syncStatus = status }
            val vm = controller(api)
            vm.start(amountRupees = 500) {}
            advanceUntilIdle()

            vm.sync()
            advanceUntilIdle()

            assertEquals(status, expected, vm.message)
            assertFalse(status, vm.isSettled)
        }
    }

    @Test
    fun `Check status without an order does nothing`() = runTest {
        val api = FakeApi()
        val vm = controller(api)

        vm.sync()
        advanceUntilIdle()

        assertEquals(0, api.statusCalls)
        assertNull(vm.message)
    }

    @Test
    fun `double-tapping Check status runs a single reconcile`() = runTest {
        val api = FakeApi().apply { status = "PENDING"; syncStatus = "CAPTURED" }
        val vm = controller(api)
        vm.start(amountRupees = 500) {}
        advanceUntilIdle()

        vm.sync()
        vm.sync()
        advanceUntilIdle()

        assertEquals(1, api.statusCalls)
        assertTrue(vm.isSettled)
    }

    // ── sheet lifecycle ───────────────────────────────────────────────────
    @Test
    fun `gateway info is fetched once and cached`() = runTest {
        val api = FakeApi()
        val vm = controller(api)

        vm.loadGatewayInfo()
        vm.loadGatewayInfo()
        advanceUntilIdle()

        assertEquals("razorpay", vm.gatewayInfo?.provider)
        assertEquals(10, vm.gatewayInfo?.minAmountRupees)
        assertFalse(vm.gatewayInfo!!.demoMode)
    }

    @Test
    fun `clearing the sheet resets order, message and flags`() = runTest {
        val api = FakeApi().apply { status = "CAPTURED" }
        val vm = controller(api)
        vm.start(amountRupees = 500) {}
        advanceUntilIdle()
        vm.sync()
        advanceUntilIdle()
        assertTrue(vm.isSettled)

        vm.clear()

        assertNull(vm.activeOrder)
        assertNull(vm.message)
        assertFalse(vm.isBusy)
        assertFalse(vm.isSettled)
    }
}
