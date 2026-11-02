package com.tourney.player

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.AssistChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.tourney.core.model.UTR_REGEX
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.CurrencyIcon
import com.tourney.core.ui.TournamentArt
import com.tourney.core.ui.UpiPay
import com.tourney.core.ui.UpiQrCode
import com.tourney.core.ui.formatMoney

/**
 * 💸 ADD CASH (UPI Deposit) MODAL
 *
 * Two-step, zero-SDK flow:
 *  1. Player picks an amount → dynamic `upi://pay` QR + "Pay via UPI App"
 *     deep link into GPay / PhonePe / Paytm.
 *  2. Player pastes the 12-character UTR reference → PENDING request.
 *
 * The balance is credited by staff after UTR verification (double-entry
 * ADD_MONEY ledger) — the app can never mint money by itself.
 */
@Composable
fun DepositModal(
    viewModel: PlayerViewModel,
    upiId: String,
    upiName: String,
    minDeposit: Int,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current

    var amountText by remember { mutableStateOf("100") }
    var utrText by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }

    val state = viewModel.depositUi
    val submitting = state is UiState.Loading
    val submitted = state as? UiState.Success

    LaunchedEffect(Unit) {
        viewModel.clearDeposit()
        viewModel.loadMyDeposits()
    }

    val amount = amountText.toDoubleOrNull() ?: 0.0
    val amountValid = amount >= minDeposit
    val utrValid = UTR_REGEX.matches(utrText.trim())
    val upiUri = remember(amount, upiId, upiName) {
        UpiPay.buildUri(
            upiId = upiId,
            payeeName = upiName,
            amount = if (amount > 0) amount else minDeposit.toDouble(),
            note = "Wallet top-up",
        )
    }

    Dialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            shape = RoundedCornerShape(22.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 28.dp),
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "➕ Add Cash",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = onDismiss, enabled = !submitting) {
                        Icon(Icons.Filled.Close, contentDescription = "Close")
                    }
                }

                if (submitted != null) {
                    // ─── Success receipt ────────────────────────────────
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text("✅", fontSize = 40.sp)
                        Text(
                            "Request submitted!",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "₹${formatMoney(submitted.data.deposit.amountValue)} • UTR ${submitted.data.deposit.utrNumber}\n" +
                                "Your balance will be credited as soon as staff verify this UTR.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                    }
                    AppButton(
                        text = "Done",
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            viewModel.clearDeposit()
                            viewModel.refreshWallet()
                            onDismiss()
                        },
                    )
                } else {

                // ─── 1. Amount ───────────────────────────────────────────
                Text(
                    "1. How much do you want to add?",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(50, 100, 200, 500).forEach { quick ->
                        AssistChip(
                            onClick = { amountText = quick.toString(); localError = null },
                            label = { Text("+₹$quick", fontSize = 12.sp) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { ch -> ch.isDigit() }.take(5); localError = null },
                    label = { Text("Amount (₹)") },
                    prefix = { Text("₹ ") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    isError = amountText.isNotEmpty() && !amountValid,
                    supportingText = {
                        Text(
                            if (amountText.isNotEmpty() && !amountValid) "Minimum add cash is ₹$minDeposit"
                            else "Max ₹50,000 per request",
                            fontSize = 11.sp,
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                )

                HorizontalDivider()

                // ─── 2. Pay via QR / UPI app ─────────────────────────────
                Text(
                    "2. Pay ₹${formatMoney(if (amount > 0) amount else minDeposit.toDouble())} to the UPI below",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    UpiQrCode(uri = upiUri, size = 152.dp)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Official UPI ID", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            upiId,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                        )
                        Text(
                            upiName,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.clickable {
                                clipboard.setText(AnnotatedString(upiId))
                                Toast.makeText(context, "UPI ID copied", Toast.LENGTH_SHORT).show()
                            },
                        ) {
                            Icon(Icons.Filled.ContentCopy, contentDescription = null, modifier = Modifier.size(14.dp))
                            Text(" Copy", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                        }
                        Text(
                            "Scan from any UPI app",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                AppButton(
                    text = "📲 Pay via UPI App (GPay / PhonePe)",
                    modifier = Modifier.fillMaxWidth(),
                    enabled = amountValid,
                    onClick = {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(upiUri))
                        try {
                            context.startActivity(intent)
                        } catch (e: ActivityNotFoundException) {
                            Toast.makeText(
                                context,
                                "No UPI app found — scan the QR instead",
                                Toast.LENGTH_LONG,
                            ).show()
                        }
                    },
                )

                HorizontalDivider()

                // ─── 3. UTR verification ─────────────────────────────────
                Text(
                    "3. Paste the UTR / Ref No. from your payment",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                OutlinedTextField(
                    value = utrText,
                    onValueChange = { utrText = it.uppercase().filter { ch -> ch.isLetterOrDigit() }.take(12); localError = null },
                    label = { Text("12-digit UTR / Transaction Ref") },
                    placeholder = { Text("e.g. 402912345678") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
                    isError = utrText.isNotEmpty() && !utrValid,
                    supportingText = {
                        Text(
                            if (utrText.isNotEmpty() && !utrValid) "UTR must be exactly 12 letters/digits"
                            else "GPay/PhonePe → transaction details → UTR / Ref no.",
                            fontSize = 11.sp,
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                )

                localError?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                }
                (state as? UiState.Error)?.let {
                    Text(it.message, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                }

                AppButton(
                    text = if (submitting) "Submitting…" else "Submit for Verification",
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !submitting && amountValid && utrValid,
                    onClick = {
                        localError = when {
                            !amountValid -> "Minimum add cash is ₹$minDeposit"
                            !utrValid -> "Enter the 12-character UTR from your UPI app"
                            else -> null
                        }
                        if (localError == null) viewModel.submitDeposit(amount, utrText)
                    },
                )

                Text(
                    "🔒 Money is credited only after staff verify your UTR. " +
                        "Fake or reused UTRs are rejected automatically.",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )

                // ─── Recent requests ─────────────────────────────────────
                (viewModel.myDepositsUi as? UiState.Success)?.data?.let { history ->
                    if (history.deposits.isNotEmpty()) {
                        HorizontalDivider()
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CurrencyIcon(TournamentArt.diamond, size = 12.dp)
                            Text(
                                "  Your recent requests",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        if (history.pendingValue > 0) {
                            Text(
                                "⏳ ₹${formatMoney(history.pendingValue)} awaiting verification",
                                fontSize = 11.sp,
                                color = Color(0xFFF9A825),
                            )
                        }
                        history.deposits.take(4).forEach { item ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                        RoundedCornerShape(8.dp),
                                    )
                                    .padding(horizontal = 10.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        "₹${formatMoney(item.amountValue)} • ${item.utrNumber}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                    )
                                    item.rejectionNote?.let {
                                        Text(it, fontSize = 10.sp, color = MaterialTheme.colorScheme.error)
                                    }
                                }
                                Text(
                                    item.statusLabel,
                                    fontSize = 10.sp,
                                    color = when (item.status) {
                                        "APPROVED" -> Color(0xFF2E7D32)
                                        "REJECTED" -> MaterialTheme.colorScheme.error
                                        else -> Color(0xFFF9A825)
                                    },
                                )
                            }
                        }
                    }
                }
                }
            }
        }
    }
}
