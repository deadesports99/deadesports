package com.tourney.player

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.razorpay.Checkout
import com.tourney.core.model.PaymentOrderCreated
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.formatMoney
import org.json.JSONObject

/**
 * ⚡ INSTANT ADD MONEY (online payment gateway)
 *
 * Flow:
 *  1. Player picks / types an amount (₹).
 *  2. `POST /api/payments/orders` creates a gateway order (amount in paise).
 *  3a. Razorpay: the native Standard Checkout opens; its success callback is
 *      forwarded by MainActivity to `PlayerViewModel.onGatewayPaymentSuccess`,
 *      which posts the signature to `/api/payments/verify`.
 *  3b. Mock: the browser opens the demo checkout; on return the sheet
 *      auto-checks the order and the wallet refreshes.
 *
 * The manual "UPI + UTR" flow (staff-verified) stays available as a fallback.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AddMoneySheet(
    viewModel: PlayerViewModel,
    onDismiss: () -> Unit,
    onManualDeposit: () -> Unit,
) {
    val context = LocalContext.current
    val config = viewModel.config

    val presets = remember(viewModel.liveSettings.minDeposit, viewModel.gatewayInfo) {
        val min = (viewModel.gatewayInfo?.minAmountRupees ?: viewModel.liveSettings.minDeposit).coerceAtLeast(1)
        listOf(min, 50, 100, 500, 1000).distinct().filter { it >= min }.sorted()
    }
    var amountText by remember { mutableStateOf("100") }

    val busy = viewModel.topUpBusy
    val message = viewModel.topUpMessage
    val settled = viewModel.topUpSettled
    val order = viewModel.activeTopUp
    val info = viewModel.gatewayInfo

    val amount = amountText.toIntOrNull() ?: 0
    val minAmount = (info?.minAmountRupees ?: viewModel.liveSettings.minDeposit).coerceAtLeast(1)
    val maxAmount = info?.maxAmountRupees ?: 10_000
    val amountTooSmall = amountText.isNotEmpty() && amount < minAmount
    val amountTooBig = amountText.isNotEmpty() && amount > maxAmount
    val canPay = amount >= minAmount && amount <= maxAmount && !busy

    // The player may return from the browser without any callback.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                val pending = viewModel.activeTopUp
                if (pending != null && !viewModel.topUpSettled) viewModel.syncTopUp()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(Unit) {
        viewModel.clearTopUp()
        viewModel.loadGatewayInfo()
    }

    Dialog(
        onDismissRequest = { if (!busy) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            shape = RoundedCornerShape(22.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 24.dp),
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "⚡ Add Money",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "Instant top-up — UPI, cards, netbanking",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp,
                        )
                    }
                    IconButton(onClick = onDismiss, enabled = !busy) {
                        Icon(Icons.Filled.Close, contentDescription = "Close")
                    }
                }

                // Be explicit: in demo mode no real money is charged.
                if (info?.demoMode == true) {
                    Surface(
                        color = Color(0x33FFB300),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "⚠ DEMO MODE — no real money is charged. Add Razorpay keys to collect real payments.",
                            fontSize = 11.sp,
                            color = Color(0xFFFFB300),
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                        )
                    }
                }

                if (settled) {
                    Text(
                        message ?: "Payment successful.",
                        color = Color(0xFF2E7D32),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                    )
                }

                if (!settled) {
                    Text(
                        "Choose amount",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        presets.forEach { preset ->
                            FilterChip(
                                selected = amountText == preset.toString(),
                                onClick = { amountText = preset.toString() },
                                enabled = !busy,
                                label = { Text("₹$preset") },
                            )
                        }
                    }

                    OutlinedTextField(
                        value = amountText,
                        onValueChange = { raw ->
                            amountText = raw.filter { it.isDigit() }.take(6)
                        },
                        label = { Text("Amount (₹)") },
                        singleLine = true,
                        enabled = !busy,
                        isError = amountTooSmall || amountTooBig,
                        supportingText = {
                            Text(
                                when {
                                    amountTooSmall -> "Minimum ₹$minAmount"
                                    amountTooBig -> "Maximum ₹$maxAmount per top-up"
                                    else -> "Money is added to your Deposit Balance"
                                },
                                fontSize = 10.sp,
                            )
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )

                    AppButton(
                        text = when {
                            order?.isRazorpay == true -> "Pay ₹${formatMoney(amount.toDouble())} securely"
                            info?.demoMode == true -> "Continue to demo checkout · ₹${formatMoney(amount.toDouble())}"
                            else -> "Continue to checkout · ₹${formatMoney(amount.toDouble())}"
                        },
                        enabled = canPay,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            viewModel.createTopUp(amount) { created ->
                                openCheckout(context, created, config.clientName)
                            }
                        },
                    )

                    if (order != null) {
                        TextButton(
                            onClick = { viewModel.syncTopUp() },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(if (busy) "Checking…" else "Already paid? Check status")
                        }
                    }

                    message?.let {
                        Text(
                            it,
                            fontSize = 12.sp,
                            color = if (it.startsWith("✅")) {
                                Color(0xFF2E7D32)
                            } else {
                                MaterialTheme.colorScheme.error
                            },
                        )
                    }

                    TextButton(
                        onClick = onManualDeposit,
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Pay via UPI & enter UTR instead", fontSize = 12.sp)
                    }
                }

                if (settled) {
                    AppButton(
                        text = "Done",
                        modifier = Modifier.fillMaxWidth(),
                        onClick = onDismiss,
                    )
                }
            }
        }
    }
}

/**
 * Open the correct checkout for the provider:
 *  - Razorpay -> native Standard Checkout (result comes back via MainActivity).
 *  - mock     -> the backend's demo checkout page in a browser.
 */
private fun openCheckout(context: Context, order: PaymentOrderCreated, brandName: String) {
    if (order.isRazorpay) {
        val activity = context.findActivity()
        if (activity == null) {
            ToastMessage.show(context, "Cannot open checkout right now. Try again.")
            return
        }
        try {
            val checkout = Checkout()
            order.keyId?.let { checkout.setKeyID(it) }
            val options = JSONObject().apply {
                put("name", brandName)
                put("description", "Wallet top-up")
                put("order_id", order.providerOrderId)
                put("amount", order.amountPaise)
                put("currency", order.currency)
                put("theme", JSONObject().put("color", "#FF4757"))
                put("retry", JSONObject().put("enabled", true))
                put("send_sms_hash", true)
            }
            checkout.open(activity, options)
        } catch (e: Exception) {
            ToastMessage.show(context, "Could not open Razorpay checkout: ${e.message}")
        }
        return
    }

    val url = order.checkoutUrl
    if (url.isNullOrBlank()) {
        ToastMessage.show(context, "Checkout link missing. Try again.")
        return
    }
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    } catch (e: ActivityNotFoundException) {
        ToastMessage.show(context, "No browser found to open the checkout.")
    }
}

/** Compose dialogs receive a ContextWrapper — unwrap it to the host Activity. */
private fun Context.findActivity(): Activity? {
    var current: Context = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return null
}

/** Tiny toast helper so the checkout helpers stay free of Compose imports. */
private object ToastMessage {
    fun show(context: Context, text: String) {
        android.widget.Toast.makeText(context, text, android.widget.Toast.LENGTH_LONG).show()
    }
}
