package com.tourney.admin

import com.tourney.core.model.AdminPaymentOrder
import com.tourney.core.model.AdminPaymentsResponse
import com.tourney.core.model.ApiException
import com.tourney.core.model.PaymentMoneySummary
import com.tourney.core.model.ReconcilePaymentResponse
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The admin's "Online" tab: list + one-tap Sync. If this drifts, an owner
 * either double-credits a player or cannot tell a paid order from a failed one.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AdminPaymentsControllerTest {

    private class FakeApi : AdminPaymentsApi {
        val listStatuses = mutableListOf<String>()
        var listCalls = 0
        var syncCalls = 0
        var listError: Exception? = null
        var syncError: Exception? = null
        var orders: List<AdminPaymentOrder> = listOf(
            AdminPaymentOrder(id = "p1", amountPaise = 50_000, amountRupees = 500.0, status = "CAPTURED"),
        )
        var syncResult = ReconcilePaymentResponse(orderId = "p1", status = "CAPTURED", balanceAfter = 1_250.0)

        override suspend fun list(status: String, page: Int, limit: Int): AdminPaymentsResponse {
            listCalls += 1
            listStatuses += status
            listError?.let { throw it }
            return AdminPaymentsResponse(
                payments = orders,
                summary = PaymentMoneySummary(
                    collectedTodayRupees = 1_500.0,
                    collectedTotalRupees = 12_000.0,
                    capturedCount = 3,
                    pendingCount = 1,
                    demoMode = false,
                ),
            )
        }

        override suspend fun sync(orderId: String): ReconcilePaymentResponse {
            syncCalls += 1
            syncError?.let { throw it }
            return syncResult
        }
    }

    private class Harness {
        val busy = mutableListOf<Boolean>()
        val feedback = mutableListOf<Pair<String?, String?>>()
        var listCallsAfterSync = 0
    }

    private fun TestScope.controller(api: FakeApi, h: Harness = Harness()): AdminPaymentsController =
        AdminPaymentsController(
            scope = this,
            api = api,
            money = { "%.2f".format(java.util.Locale.US, it) },
            onBusy = { h.busy += it },
            onFeedback = { message, error -> h.feedback += message to error },
        )

    // ── list ───────────────────────────────────────────────────────────────
    @Test
    fun `loads the list with the money summary the owner needs first`() = runTest {
        val api = FakeApi()
        val vm = controller(api)

        vm.load("ALL")
        advanceUntilIdle()

        val data = (vm.ui as AdminUi.Success).data
        assertEquals(1_500.0, data.summary.collectedTodayRupees, 0.001)
        assertEquals(12_000.0, data.summary.collectedTotalRupees, 0.001)
        assertEquals(3, data.summary.capturedCount)
        assertEquals("p1", data.payments.single().id)
        assertFalse(data.summary.demoMode)
        assertEquals(listOf("ALL"), api.listStatuses)
    }

    @Test
    fun `shows a loading state before the list arrives`() = runTest {
        val vm = controller(FakeApi())

        vm.load("ALL")
        assertEquals(AdminUi.Loading, vm.ui)

        advanceUntilIdle()
        assertTrue(vm.ui is AdminUi.Success)
    }

    @Test
    fun `a server error keeps the filter and shows the message`() = runTest {
        val api = FakeApi().apply { listError = ApiException(403, "Admin access required") }
        val vm = controller(api)

        vm.load("FAILED")
        advanceUntilIdle()

        assertEquals("FAILED", vm.filter)
        assertEquals("Admin access required", (vm.ui as AdminUi.Error).message)
    }

    @Test
    fun `a network crash becomes a readable error, not a blank screen`() = runTest {
        val api = FakeApi().apply { listError = IllegalStateException("timeout") }
        val vm = controller(api)

        vm.load()
        advanceUntilIdle()

        assertEquals("Network error — is the server running?", (vm.ui as AdminUi.Error).message)
    }

    @Test
    fun `the chosen filter is remembered`() = runTest {
        val api = FakeApi()
        val vm = controller(api)

        vm.load("EXPIRED")
        advanceUntilIdle()
        vm.load("FAILED")
        advanceUntilIdle()

        assertEquals("FAILED", vm.filter)
        assertEquals(listOf("EXPIRED", "FAILED"), api.listStatuses)
    }

    // ── sync ───────────────────────────────────────────────────────────────
    @Test
    fun `sync settles and reports the new balance`() = runTest {
        val api = FakeApi()
        val h = Harness()
        val vm = controller(api, h)

        vm.sync("p1")
        advanceUntilIdle()

        assertEquals(1, api.syncCalls)
        assertEquals("Paid ✓ — wallet balance now ₹1250.00", h.feedback.last().first)
        assertNull(h.feedback.last().second)
        assertEquals(listOf(true, false), h.busy)
        assertFalse(vm.isBusy)
    }

    @Test
    fun `sync keeps the current filter after refreshing the list`() = runTest {
        val api = FakeApi()
        val h = Harness()
        val vm = controller(api, h)

        vm.load("FAILED")
        advanceUntilIdle()
        vm.sync("p1")
        advanceUntilIdle()

        assertEquals(listOf("FAILED", "FAILED"), api.listStatuses)
    }

    @Test
    fun `an already settled order says so instead of crediting again`() = runTest {
        val api = FakeApi().apply {
            syncResult = ReconcilePaymentResponse(orderId = "p1", status = "CAPTURED", alreadySettled = true)
        }
        val h = Harness()
        val vm = controller(api, h)

        vm.sync("p1")
        advanceUntilIdle()

        assertEquals("Already captured — wallet was credited earlier ✓", h.feedback.last().first)
    }

    @Test
    fun `an unpaid order names the gateway status`() = runTest {
        val api = FakeApi().apply {
            syncResult = ReconcilePaymentResponse(orderId = "p1", status = "PENDING", gatewayStatus = "created")
        }
        val h = Harness()
        val vm = controller(api, h)

        vm.sync("p1")
        advanceUntilIdle()

        assertEquals("Gateway says: created — not paid yet", h.feedback.last().first)
    }

    @Test
    fun `an unpaid order without a gateway status falls back to the local status`() = runTest {
        val api = FakeApi().apply {
            syncResult = ReconcilePaymentResponse(orderId = "p1", status = "FAILED")
        }
        val h = Harness()
        val vm = controller(api, h)

        vm.sync("p1")
        advanceUntilIdle()

        assertEquals("Gateway says: FAILED — not paid yet", h.feedback.last().first)
    }

    @Test
    fun `a failed sync explains itself and does not reload the list`() = runTest {
        val api = FakeApi().apply { syncError = ApiException(502, "Payment gateway unreachable") }
        val h = Harness()
        val vm = controller(api, h)

        vm.sync("p1")
        advanceUntilIdle()

        assertEquals("Payment gateway unreachable", h.feedback.last().second)
        assertNull(h.feedback.last().first)
        assertFalse(vm.isBusy)
    }

    @Test
    fun `double-tapping Sync reconciles only once`() = runTest {
        val api = FakeApi()
        val h = Harness()
        val vm = controller(api, h)

        vm.sync("p1")
        vm.sync("p1")
        advanceUntilIdle()

        assertEquals(1, api.syncCalls)
    }

    @Test
    fun `sync clears stale feedback before asking the gateway`() = runTest {
        val api = FakeApi()
        val h = Harness()
        val vm = controller(api, h)

        vm.sync("p1")
        advanceUntilIdle()

        assertEquals(null to null, h.feedback.first())
        assertEquals(2, h.feedback.size)
    }
}
