package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.AdminWithdrawal
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMoney

/**
 * Withdrawal Management (canManageWallet) — the admin approval queue:
 * Approve (UTR number) or Reject (reason, auto-refunds the player).
 */
@Composable
fun AdminWalletScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    var statusFilter by remember { mutableStateOf("PENDING") }
    var approveTarget by remember { mutableStateOf<AdminWithdrawal?>(null) }
    var rejectTarget by remember { mutableStateOf<AdminWithdrawal?>(null) }
    var utrText by remember { mutableStateOf("") }
    var reasonText by remember { mutableStateOf("") }

    val state = viewModel.withdrawalsUi

    LaunchedEffect(statusFilter) { viewModel.loadWithdrawals(statusFilter) }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(title = "Withdrawals", onBack = onBack)

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf("PENDING", "APPROVED", "REJECTED").forEach { s ->
                FilterChip(
                    selected = statusFilter == s,
                    onClick = { statusFilter = s; viewModel.clearWalletFeedback() },
                    label = { Text(s) },
                )
            }
        }

        viewModel.walletMessage?.let {
            Text(
                it,
                color = Color(0xFF1B5E20),
                fontSize = 13.sp,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }
        viewModel.walletError?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                fontSize = 13.sp,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }

        when (state) {
            AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading withdrawals…")
            is AdminUi.Error -> ErrorState(state.message) { viewModel.loadWithdrawals(statusFilter) }
            is AdminUi.Success -> {
                val items = state.data.withdrawals
                if (items.isEmpty()) {
                    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            if (statusFilter == "PENDING") "No pending withdrawal requests 🎉"
                            else "No $statusFilter withdrawals.",
                            style = MaterialTheme.typography.titleMedium,
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(items, key = { it.id }) { w ->
                            WithdrawalCard(
                                w = w,
                                busy = viewModel.walletBusy,
                                onApprove = { approveTarget = w; utrText = "" },
                                onReject = { rejectTarget = w; reasonText = "" },
                            )
                        }
                    }
                }
            }
        }
    }

    // Approve dialog (UTR input)
    approveTarget?.let { w ->
        AlertDialog(
            onDismissRequest = { if (!viewModel.walletBusy) approveTarget = null },
            title = { Text("Approve ₹${formatMoney(w.amountValue)}?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Paying ${w.player.inGameName ?: "player"} to UPI ${w.upiId}. Enter the UTR number of your transfer.",
                        fontSize = 13.sp,
                    )
                    OutlinedTextField(
                        value = utrText,
                        onValueChange = { utrText = it.take(64) },
                        label = { Text("UTR Number") },
                        placeholder = { Text("e.g. 409012345678") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                AppButton(
                    text = if (viewModel.walletBusy) "Approving…" else "Approve & Mark Paid",
                    enabled = !viewModel.walletBusy && utrText.trim().length >= 6,
                    onClick = {
                        viewModel.approveWithdrawal(w.id, utrText.trim())
                        approveTarget = null
                    },
                )
            },
            dismissButton = {
                TextButton(onClick = { approveTarget = null }, enabled = !viewModel.walletBusy) { Text("Cancel") }
            },
        )
    }

    // Reject dialog (reason input, auto-refund)
    rejectTarget?.let { w ->
        AlertDialog(
            onDismissRequest = { if (!viewModel.walletBusy) rejectTarget = null },
            title = { Text("Reject ₹${formatMoney(w.amountValue)}?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "The winning balance will be refunded to ${w.player.inGameName ?: "the player"} automatically.",
                        fontSize = 13.sp,
                    )
                    OutlinedTextField(
                        value = reasonText,
                        onValueChange = { reasonText = it.take(255) },
                        label = { Text("Rejection reason") },
                        placeholder = { Text("Wrong UPI details…") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                AppButton(
                    text = if (viewModel.walletBusy) "Rejecting…" else "Reject & Refund",
                    enabled = !viewModel.walletBusy && reasonText.trim().length >= 3,
                    onClick = {
                        viewModel.rejectWithdrawal(w.id, reasonText.trim())
                        rejectTarget = null
                    },
                )
            },
            dismissButton = {
                TextButton(onClick = { rejectTarget = null }, enabled = !viewModel.walletBusy) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun WithdrawalCard(
    w: AdminWithdrawal,
    busy: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    val isPending = w.status == "PENDING"
    GlassCard(cornerRadius = 14.dp, modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "${w.player.inGameName ?: "Unknown"} • UID ${w.player.inGameUid ?: "-"}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Phone ${w.player.phoneNumber}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 12.sp,
                    )
                }
                Text(
                    "₹${formatMoney(w.amountValue)}",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (isPending) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Text(
                "UPI: ${w.upiId}",
                style = MaterialTheme.typography.bodyMedium,
                fontSize = 13.sp,
            )

            when {
                w.status == "APPROVED" -> Text(
                    "✅ Paid • UTR ${w.utrNumber ?: "-"}",
                    color = Color(0xFF1B5E20),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                )
                w.status == "REJECTED" -> Text(
                    "❌ ${w.rejectionNote ?: "Rejected"}",
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp,
                )
                else -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    AppButton(text = "Approve ✓", enabled = !busy, onClick = onApprove, modifier = Modifier.weight(1f))
                    AppButton(text = "Reject ✕", enabled = !busy, onClick = onReject, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}