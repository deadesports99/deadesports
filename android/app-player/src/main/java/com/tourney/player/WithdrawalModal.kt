package com.tourney.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.ui.AppButton

/**
 * UPI Withdrawal modal (battle-zone lifecycle): strict handle@bank validation,
 * min ₹50, and cannot exceed the winning balance. Sends a deviceId fraud
 * signal with the request.
 */
@Composable
fun WithdrawalModal(
    winningBalance: Double,
    viewModel: PlayerViewModel,
    onDismiss: () -> Unit,
) {
    var upiId by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    val state = viewModel.withdrawUi
    var submitted by remember { mutableStateOf(false) }

    // Success → close and let the wallet refresh.
    LaunchedEffect(state) {
        when (state) {
            is UiState.Success<*> -> {
                submitted = false
                viewModel.clearWithdraw()
                onDismiss()
            }
            is UiState.Error -> {
                error = state.message
                submitted = false
            }
            else -> {}
        }
    }

    val amount = amountText.toDoubleOrNull()
    val upiValid = UPI_ID_REGEX.matches(upiId.trim())
    val amountValid = amount != null && amount >= 50 && amount <= winningBalance
    val busy = submitted

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Withdraw Winnings 💸") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Available to withdraw: ₹${formatMoney(winningBalance)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = upiId,
                    onValueChange = { upiId = it.take(300); error = null },
                    label = { Text("UPI ID") },
                    placeholder = { Text("yourname@okaxis / @ybl") },
                    singleLine = true,
                    isError = upiId.isNotBlank() && !upiValid,
                    supportingText = {
                        if (upiId.isNotBlank() && !upiValid) Text("Use format handle@bank (e.g. rahul@okaxis)", fontSize = 11.sp)
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' }.take(9); error = null },
                    label = { Text("Amount (₹)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    isError = amount != null && (amount < 50 || amount > winningBalance),
                    supportingText = {
                        when {
                            amount != null && amount < 50 -> Text("Minimum withdrawal is ₹50", fontSize = 11.sp)
                            amount != null && amount > winningBalance -> Text("Cannot exceed winning balance", fontSize = 11.sp)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    "The amount is held on request and paid after the owner approves. Wrong details = refund.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 11.sp,
                )
                if (error != null) {
                    Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                }
            }
        },
        confirmButton = {
            AppButton(
                text = if (busy) "Submitting…" else "Submit Request",
                enabled = !busy && upiValid && amountValid,
                onClick = {
                    error = null
                    submitted = true
                    viewModel.withdraw(upiId.trim(), amount!!)
                },
            )
        },
        dismissButton = {
            androidx.compose.material3.TextButton(onClick = onDismiss, enabled = !busy) {
                Text("Cancel")
            }
        },
    )
}