package com.tourney.admin

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.tourney.core.model.AdminPaymentsResponse
import com.tourney.core.model.ApiException
import com.tourney.core.model.ReconcilePaymentResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Gateway calls the admin online-payments tab needs (fakeable in tests). */
interface AdminPaymentsApi {
    suspend fun list(status: String, page: Int = 1, limit: Int = 30): AdminPaymentsResponse
    suspend fun sync(orderId: String): ReconcilePaymentResponse
}

/**
 * Admin "⚡ Online" tab: the list, the remembered filter and the one-tap Sync.
 *
 * Rules that must never drift:
 *  - the filter survives a sync (an admin working on FAILED never lands back on ALL),
 *  - Sync never fires twice for the same tap (money reconciliation is idempotent
 *    server-side, but the UI must not spam the gateway),
 *  - the message tells paid / already-paid / not-paid apart, with the new balance.
 *
 * Pure Kotlin + Compose state: unit-testable without Android.
 */
class AdminPaymentsController(
    private val scope: CoroutineScope,
    private val api: AdminPaymentsApi,
    private val money: (Double) -> String = { "%.2f".format(java.util.Locale.US, it) },
    /** Mirrors the busy flag into the shared wallet console (existing UI contract). */
    private val onBusy: (Boolean) -> Unit = {},
    /** `(message, error)` — shown in the wallet console banner. */
    private val onFeedback: (String?, String?) -> Unit = { _, _ -> },
) {
    var ui by mutableStateOf<AdminUi<AdminPaymentsResponse>>(AdminUi.Idle)
        private set

    /** Last filter chosen by the screen; reused after a sync. */
    var filter: String = "ALL"
        private set

    var isBusy by mutableStateOf(false)
        private set

    var listCalls = 0
        private set

    fun load(status: String = "ALL") {
        filter = status
        ui = AdminUi.Loading
        listCalls += 1
        scope.launch {
            ui = try {
                AdminUi.Success(api.list(status))
            } catch (e: ApiException) {
                AdminUi.Error(e.message)
            } catch (_: Exception) {
                AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    /** Ask the gateway what really happened and settle if money was captured. */
    fun sync(orderId: String) {
        if (isBusy) return
        isBusy = true
        onBusy(true)
        onFeedback(null, null)
        scope.launch {
            try {
                val result = api.sync(orderId)
                onFeedback(syncMessage(result), null)
                // Refresh with the SAME filter: an admin working on FAILED stays there.
                load(filter)
            } catch (e: ApiException) {
                onFeedback(null, e.message)
            } catch (_: Exception) {
                onFeedback(null, "Network error — is the server running?")
            } finally {
                isBusy = false
                onBusy(false)
            }
        }
    }

    /** Wording for every Sync outcome — the only thing an admin reads before acting. */
    fun syncMessage(result: ReconcilePaymentResponse): String = when {
        result.status == "CAPTURED" && result.alreadySettled ->
            "Already captured — wallet was credited earlier ✓"
        result.status == "CAPTURED" ->
            result.balanceAfter?.let { "Paid ✓ — wallet balance now ₹${money(it)}" }
                ?: "Paid ✓ — wallet credited"
        else -> "Gateway says: ${result.gatewayStatus ?: result.status} — not paid yet"
    }
}
