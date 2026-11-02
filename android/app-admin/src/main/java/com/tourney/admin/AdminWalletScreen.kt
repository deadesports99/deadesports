package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
import com.tourney.core.model.AdminDeposit
import com.tourney.core.model.AdminWithdrawal
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMoney

/**
 * 💰 WALLET CONSOLE (canManageWallet)
 *
 * Two queues in one screen:
 *  • Withdrawals — player → UPI payouts. Approve with the payout UTR, or
 *    reject (auto-refunds the winning balance).
 *  • Deposits — player "Add Cash" claims. Verify the UTR then 1-click credit
 *    the deposit balance (double-entry ADD_MONEY ledger), or reject.
 */
@Composable
fun AdminWalletScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    var tab by remember { mutableStateOf(0) } // 0 = Withdrawals, 1 = Deposits
    var statusFilter by remember { mutableStateOf("PENDING") }

    var approveTarget by remember { mutableStateOf<AdminWithdrawal?>(null) }
    var rejectTarget by remember { mutableStateOf<AdminWithdrawal?>(null) }
    var utrText by remember { mutableStateOf("") }
    var reasonText by remember { mutableStateOf("") }

    var depositApproveTarget by remember { mutableStateOf<AdminDeposit?>(null) }
    var depositRejectTarget by remember { mutableStateOf<AdminDeposit?>(null) }

    LaunchedEffect(tab, statusFilter) {
        viewModel.clearWalletFeedback()
        if (tab == 0) viewModel.loadWithdrawals(statusFilter) else viewModel.loadDeposits(statusFilter)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(title = "Wallet Console", onBack = onBack)

        TabRow(selectedTabIndex = tab) {
            Tab(
                selected = tab == 0,
                onClick = { tab = 0 },
                text = { Text("💸 Withdrawals", fontWeight = FontWeight.SemiBold) },
            )
            Tab(
                selected = tab == 1,
                onClick = { tab = 1 },
                text = { Text("➕ Deposits", fontWeight = FontWeight.SemiBold) },
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf("PENDING", "APPROVED", "REJECTED").forEach { s ->
                FilterChip(
                    selected = statusFilter == s,
                    onClick = { statusFilter = s },
                    label = { Text(s, fontSize = 11.sp) },
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

        if (tab == 0) {
            val state = viewModel.withdrawalsUi
            when (state) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading withdrawals…")
                is AdminUi.Error -> ErrorState(state.message) { viewModel.loadWithdrawals(statusFilter) }
                is AdminUi.Success -> {
                    val items = state.data.withdrawals
                    if (items.isEmpty()) {
                        EmptyQueue(
                            title = if (statusFilter == "PENDING") "No pending withdrawal requests 🎉" else "No $statusFilter withdrawals.",
                            hint = "Players request UPI payouts from their winning balance.",
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
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
        } else {
            val state = viewModel.depositsUi
            when (state) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading deposits…")
                is AdminUi.Error -> ErrorState(state.message) { viewModel.loadDeposits(statusFilter) }
                is AdminUi.Success -> {
                    val items = state.data.deposits
                    if (items.isEmpty()) {
                        EmptyQueue(
                            title = if (statusFilter == "PENDING") "No pending Add Cash requests 🎉" else "No $statusFilter deposits.",
                            hint = "Players pay your UPI ID, then submit a 12-digit UTR for verification.",
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            if (state.data.pendingTotal.toDoubleOrNull()?.let { it > 0 } == true) {
                                item {
                                    Text(
                                        "Pending verification total: ₹${formatMoney(state.data.pendingTotal.toDoubleOrNull() ?: 0.0)}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFFF9A825),
                                    )
                                }
                            }
                            items(items, key = { it.id }) { d ->
                                DepositCard(
                                    d = d,
                                    busy = viewModel.walletBusy,
                                    onApprove = { depositApproveTarget = d },
                                    onReject = { depositRejectTarget = d; reasonText = "" },
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // ─── Withdrawal approve (payout UTR) ─────────────────────────────────
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

    // ─── Withdrawal reject (auto-refund) ─────────────────────────────────
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

    // ─── Deposit approve (credit balance) ────────────────────────────────
    depositApproveTarget?.let { d ->
        AlertDialog(
            onDismissRequest = { if (!viewModel.walletBusy) depositApproveTarget = null },
            title = { Text("Credit ₹${formatMoney(d.amountValue)}?") },
            text = {
                Text(
                    "Verify the UTR in your bank/UPI app, then credit " +
                        "${d.player.inGameName ?: "the player"}'s deposit balance.\n\n" +
                        "UTR: ${d.utrNumber}\nPhone: ${d.player.phoneNumber}",
                    fontSize = 13.sp,
                )
            },
            confirmButton = {
                AppButton(
                    text = if (viewModel.walletBusy) "Crediting…" else "Approve & Credit Balance",
                    enabled = !viewModel.walletBusy,
                    onClick = {
                        viewModel.approveDeposit(d.id)
                        depositApproveTarget = null
                    },
                )
            },
            dismissButton = {
                TextButton(onClick = { depositApproveTarget = null }, enabled = !viewModel.walletBusy) { Text("Cancel") }
            },
        )
    }

    // ─── Deposit reject ──────────────────────────────────────────────────
    depositRejectTarget?.let { d ->
        AlertDialog(
            onDismissRequest = { if (!viewModel.walletBusy) depositRejectTarget = null },
            title = { Text("Reject ₹${formatMoney(d.amountValue)}?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "No money is credited. The player sees this reason in the Add Cash screen.",
                        fontSize = 13.sp,
                    )
                    OutlinedTextField(
                        value = reasonText,
                        onValueChange = { reasonText = it.take(255) },
                        label = { Text("Rejection reason") },
                        placeholder = { Text("UTR not found / amount mismatch…") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                AppButton(
                    text = if (viewModel.walletBusy) "Rejecting…" else "Reject Deposit",
                    enabled = !viewModel.walletBusy && reasonText.trim().length >= 3,
                    onClick = {
                        viewModel.rejectDeposit(d.id, reasonText.trim())
                        depositRejectTarget = null
                    },
                )
            },
            dismissButton = {
                TextButton(onClick = { depositRejectTarget = null }, enabled = !viewModel.walletBusy) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun EmptyQueue(title: String, hint: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("🎉", fontSize = 30.sp)
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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

            Text("UPI: ${w.upiId}", style = MaterialTheme.typography.bodyMedium, fontSize = 13.sp)

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

@Composable
private fun DepositCard(
    d: AdminDeposit,
    busy: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    val isPending = d.status == "PENDING"
    GlassCard(cornerRadius = 14.dp, modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "${d.player.inGameName ?: "Unknown"} • UID ${d.player.inGameUid ?: "-"}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Phone ${d.player.phoneNumber}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 12.sp,
                    )
                }
                Text(
                    "₹${formatMoney(d.amountValue)}",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (isPending) Color(0xFF2E7D32) else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Text(
                "UTR / Ref: ${d.utrNumber}",
                style = MaterialTheme.typography.bodyMedium,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )

            when {
                d.status == "APPROVED" -> Text(
                    "✅ Credited to deposit balance",
                    color = Color(0xFF1B5E20),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                )
                d.status == "REJECTED" -> Text(
                    "❌ ${d.rejectionNote ?: "Rejected"}",
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp,
                )
                else -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    AppButton(
                        text = "Approve & Credit",
                        enabled = !busy,
                        onClick = onApprove,
                        modifier = Modifier.weight(1f),
                    )
                    AppButton(
                        text = "Reject ✕",
                        enabled = !busy,
                        onClick = onReject,
                        modifier = Modifier.weight(0.6f),
                    )
                }
            }
        }
    }
}
