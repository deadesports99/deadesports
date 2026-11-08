package com.tourney.player.ui.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.NorthEast
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Smartphone
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.ui.formatMoney
import com.tourney.player.PlayerViewModel
import com.tourney.player.UiState
import com.tourney.player.ui.common.DemoCompactField
import com.tourney.player.ui.common.DemoMessage
import com.tourney.player.ui.common.DemoSheetLabel
import com.tourney.player.ui.common.GoldButton
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

private const val MIN_WITHDRAWAL = 50.0

/**
 * Withdraw sheet — port of the approved demo's `WithdrawModal.tsx`.
 *
 * Available-winnings box -> payout destination toggle (UPI VPA / bank) ->
 * destination inputs -> amount with a MAX shortcut -> info note -> CTA.
 * The API currently only settles UPI payouts, so the bank tab is visual
 * parity and its CTA stays disabled until the backend supports it.
 */
private enum class PayoutMethod { UPI, BANK }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WithdrawSheet(
    viewModel: PlayerViewModel,
    onDismiss: () -> Unit,
    onDone: (String) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val wallet = (viewModel.walletUi as? UiState.Success)?.data
    val winnings = wallet?.winningValue ?: 0.0

    var method by remember { mutableStateOf(PayoutMethod.UPI) }
    var upiId by remember { mutableStateOf("") }
    var accountNumber by remember { mutableStateOf("") }
    var ifsc by remember { mutableStateOf("") }
    var holderName by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("") }
    var submitted by remember { mutableStateOf(false) }

    val amount = amountText.toDoubleOrNull() ?: 0.0
    val busy = viewModel.withdrawUi is UiState.Loading
    val errorText = (viewModel.withdrawUi as? UiState.Error)?.message

    LaunchedEffect(viewModel.withdrawUi) {
        val done = viewModel.withdrawUi as? UiState.Success ?: return@LaunchedEffect
        if (!submitted) return@LaunchedEffect
        onDone("₹${formatMoney(amount)} withdrawal requested — admin will approve it.")
        onDismiss()
        done.hashCode() // keep the reference so the effect re-runs on a new response
    }

    val amountOk = amount >= MIN_WITHDRAWAL && amount <= winnings
    val upiOk = upiId.contains('@') && upiId.length >= 5
    val canWithdraw = method == PayoutMethod.UPI && amountOk && upiOk && !busy

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DemoColors.Card,
        contentColor = DemoColors.TextPrimary,
        shape = RoundedCornerShape(topStart = DemoRadius.Sheet, topEnd = DemoRadius.Sheet),
        dragHandle = {},
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 24.dp),
        ) {
            // Compact grab bar (the default one wastes vertical space)
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(top = 14.dp, bottom = 14.dp)
                    .width(44.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(DemoRadius.Pill))
                    .background(DemoColors.TextMuted.copy(alpha = 0.35f)),
            )

            // ── Available winnings box ──────────────────────────────
            AvailableWinnings(winnings)

            // ── Payout destination ──────────────────────────────────
            Column(modifier = Modifier.padding(top = 12.dp)) {
                DemoSheetLabel("PAYOUT DESTINATION")
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 7.dp)
                        .clip(RoundedCornerShape(DemoRadius.Field))
                        .background(DemoColors.Field)
                        .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    PayoutTab(Icons.Filled.Smartphone, "UPI VPA", method == PayoutMethod.UPI) {
                        method = PayoutMethod.UPI
                    }
                    PayoutTab(Icons.Filled.AccountBalance, "Bank (IMPS)", method == PayoutMethod.BANK) {
                        method = PayoutMethod.BANK
                    }
                }
            }

            // ── Destination inputs ──────────────────────────────────
            if (method == PayoutMethod.UPI) {
                Column(modifier = Modifier.padding(top = 10.dp)) {
                    DemoSheetLabel("ENTER UPI ID (VPA)")
                    DemoCompactField(
                        value = upiId,
                        onValueChange = { upiId = it.take(60) },
                        placeholder = "e.g. mobile@paytm or name@oksbi",
                        enabled = !busy,
                        isError = upiId.isNotEmpty() && !upiOk,
                        modifier = Modifier.padding(top = 7.dp),
                    )
                }
            } else {
                Column(modifier = Modifier.padding(top = 10.dp)) {
                    DemoSheetLabel("BANK ACCOUNT NUMBER")
                    DemoCompactField(
                        value = accountNumber,
                        onValueChange = { accountNumber = it.filter { ch -> ch.isDigit() }.take(18) },
                        placeholder = "Enter 9-18 digit account number",
                        enabled = !busy,
                        isError = false,
                        keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                        modifier = Modifier.padding(top = 7.dp),
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            DemoSheetLabel("IFSC CODE")
                            DemoCompactField(
                                value = ifsc,
                                onValueChange = { ifsc = it.uppercase().take(11) },
                                placeholder = "SBIN0001234",
                                enabled = !busy,
                                isError = false,
                                modifier = Modifier.padding(top = 7.dp),
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            DemoSheetLabel("ACCOUNT HOLDER NAME")
                            DemoCompactField(
                                value = holderName,
                                onValueChange = { holderName = it.take(40) },
                                placeholder = "As per passbook",
                                enabled = !busy,
                                isError = false,
                                modifier = Modifier.padding(top = 7.dp),
                            )
                        }
                    }
                    Text(
                        "Instant payouts currently support UPI only.",
                        fontSize = DemoText.Tiny,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.Warning,
                        modifier = Modifier.padding(top = 6.dp, start = 4.dp),
                    )
                }
            }

            // ── Amount ──────────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                DemoSheetLabel("WITHDRAWAL AMOUNT")
                Spacer(Modifier.weight(1f))
                Text(
                    "Min. ₹50",
                    fontSize = DemoText.Tiny,
                    fontWeight = FontWeight.Medium,
                    color = DemoColors.TextMuted,
                )
            }
            DemoCompactField(
                value = amountText,
                onValueChange = { amountText = it.filter { ch -> ch.isDigit() || ch == '.' }.take(9) },
                placeholder = "Min. ₹50",
                enabled = !busy,
                isError = amountText.isNotEmpty() && !amountOk,
                prefix = "₹",
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                trailing = {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(DemoColors.CardMuted)
                            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(8.dp))
                            .clickable { amountText = maxWithdrawAmount(winnings) }
                            .padding(horizontal = 7.dp, vertical = 4.dp),
                    ) {
                        Text(
                            "MAX",
                            fontSize = DemoText.Micro,
                            fontWeight = FontWeight.Black,
                            color = DemoColors.TextPrimary,
                        )
                    }
                },
                modifier = Modifier.padding(top = 7.dp),
            )
            if (amountText.isNotEmpty() && !amountOk) {
                Text(
                    when {
                        amount < MIN_WITHDRAWAL -> "Minimum withdrawal is ₹50."
                        else -> "You can withdraw up to ₹${formatMoney(winnings)} from winnings."
                    },
                    fontSize = DemoText.Tiny,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.Danger,
                    modifier = Modifier.padding(top = 5.dp, start = 4.dp),
                )
            }

            // ── Info note ───────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Filled.Schedule,
                    contentDescription = null,
                    tint = DemoColors.TextMuted,
                    modifier = Modifier.size(11.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "Average transfer: 2 minutes",
                    fontSize = DemoText.Tiny,
                    fontWeight = FontWeight.Medium,
                    color = DemoColors.TextMuted,
                )
                Spacer(Modifier.weight(1f))
                Icon(
                    Icons.Filled.VerifiedUser,
                    contentDescription = null,
                    tint = DemoColors.Success,
                    modifier = Modifier.size(12.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "Zero deduction",
                    fontSize = DemoText.Tiny,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.Success,
                )
            }

            if (errorText != null) {
                Box(modifier = Modifier.padding(top = 10.dp)) {
                    DemoMessage(errorText)
                }
            }

            // ── CTA ─────────────────────────────────────────────────
            GoldButton(
                text = when {
                    busy -> "Sending request..."
                    else -> "Transfer ₹${formatMoney(amount)} Instantly"
                },
                onClick = {
                    submitted = true
                    viewModel.withdraw(upiId.trim(), amount)
                },
                enabled = canWithdraw,
                loading = busy,
                leading = {
                    Icon(
                        Icons.Filled.NorthEast,
                        contentDescription = null,
                        tint = DemoColors.OnGold,
                        modifier = Modifier.size(14.dp),
                    )
                },
                modifier = Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .height(48.dp),
            )
        }
    }
}

/** The demo's "Available Winnings" box: amount on the left, pill on the right. */
@Composable
private fun AvailableWinnings(winnings: Double) {
    val isDark = DemoColors.isDark
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(if (isDark) DemoColors.Field else DemoColors.Success.copy(alpha = 0.08f))
            .border(
                1.dp,
                if (isDark) DemoColors.BorderSoft else DemoColors.Success.copy(alpha = 0.25f),
                RoundedCornerShape(DemoRadius.Field),
            )
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "AVAILABLE WINNINGS",
                fontSize = DemoText.Tiny,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
                letterSpacing = 0.5.sp,
            )
            Text(
                "₹${formatMoney(winnings)}",
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = DemoColors.Success,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Text(
            "100% WITHDRAWABLE",
            fontSize = DemoText.Micro,
            fontWeight = FontWeight.Bold,
            color = DemoColors.Success,
            modifier = Modifier
                .clip(RoundedCornerShape(DemoRadius.Pill))
                .background(DemoColors.Success.copy(alpha = 0.15f))
                .padding(horizontal = 8.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.PayoutTab(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(9.dp))
            .background(if (selected) DemoColors.CardElevated else androidx.compose.ui.graphics.Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 9.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (selected) DemoColors.TextPrimary else DemoColors.TextMuted,
            modifier = Modifier.size(14.dp),
        )
        Spacer(Modifier.width(5.dp))
        Text(
            text,
            fontSize = DemoText.Small,
            fontWeight = if (selected) FontWeight.Black else FontWeight.Bold,
            color = if (selected) DemoColors.TextPrimary else DemoColors.TextMuted,
        )
    }
}

/** The MAX shortcut fills the whole winnings balance, without trailing zeroes. */
private fun maxWithdrawAmount(winnings: Double): String =
    if (winnings % 1.0 == 0.0) winnings.toInt().toString() else winnings.toString()
