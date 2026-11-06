package com.tourney.player.ui.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
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
import com.tourney.player.ui.common.DemoMessage
import com.tourney.player.ui.common.DemoTextField
import com.tourney.player.ui.common.GoldButton
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

private const val MIN_WITHDRAWAL = 50.0

/**
 * Withdraw sheet — demo styling over the real `POST /wallet/withdraw` call.
 * Only winnings can leave the wallet (deposit cash is entry-fee money), and the
 * server re-checks the minimum and the balance.
 */
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

    var amountText by remember { mutableStateOf("") }
    var upiId by remember { mutableStateOf("") }
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

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DemoColors.Card,
        contentColor = DemoColors.TextPrimary,
        shape = RoundedCornerShape(topStart = DemoRadius.Sheet, topEnd = DemoRadius.Sheet),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 28.dp),
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(bottom = 14.dp)
                    .width(48.dp)
                    .height(5.dp)
                    .clip(RoundedCornerShape(DemoRadius.Pill))
                    .background(DemoColors.TextMuted.copy(alpha = 0.35f)),
            )

            Text(
                "WITHDRAW WINNINGS",
                fontSize = DemoText.Tiny,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextMuted,
            )
            Text(
                "₹${formatMoney(winnings)} available",
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextPrimary,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(
                "Money is sent to your UPI ID after the organiser approves it.",
                fontSize = DemoText.Body,
                color = DemoColors.TextFaint,
                modifier = Modifier.padding(top = 4.dp),
            )

            DemoTextField(
                value = upiId,
                onValueChange = { upiId = it },
                label = "UPI ID",
                placeholder = "name@oksbi",
                enabled = !busy,
                maxLength = 60,
                modifier = Modifier.padding(top = 16.dp),
            )

            DemoTextField(
                value = amountText,
                onValueChange = { amountText = it.filter { ch -> ch.isDigit() || ch == '.' } },
                label = "Amount (₹)",
                placeholder = "Minimum ₹50",
                enabled = !busy,
                digitsOnly = true,
                maxLength = 6,
                isError = amountText.isNotEmpty() && !amountOk,
                modifier = Modifier.padding(top = 10.dp),
            )

            if (amountText.isNotEmpty() && !amountOk) {
                Text(
                    when {
                        amount < MIN_WITHDRAWAL -> "Minimum withdrawal is ₹50."
                        else -> "You can withdraw up to ₹${formatMoney(winnings)} from winnings."
                    },
                    fontSize = DemoText.Tiny,
                    color = DemoColors.TextFaint,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }

            if (errorText != null) {
                Box(modifier = Modifier.padding(top = 10.dp)) {
                    DemoMessage(errorText)
                }
            }

            GoldButton(
                text = when {
                    busy -> "Sending request..."
                    else -> "Withdraw ₹${formatMoney(amount)} to UPI"
                },
                onClick = {
                    submitted = true
                    viewModel.withdraw(upiId.trim(), amount)
                },
                enabled = amountOk && upiOk && !busy,
                loading = busy,
                modifier = Modifier
                    .padding(top = 16.dp)
                    .fillMaxWidth()
                    .height(48.dp),
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(
                    "Cancel",
                    fontSize = DemoText.Small,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.TextMuted,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { onDismiss() }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                )
            }
        }
    }
}
