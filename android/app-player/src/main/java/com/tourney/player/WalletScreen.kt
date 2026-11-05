package com.tourney.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.LedgerEntry
import com.tourney.core.model.PlayerDepositsResponse
import com.tourney.core.model.WalletSummary
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.CurrencyIcon
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.TournamentArt
import com.tourney.core.ui.formatMoney

/**
 * Wallet — deposit + winning balances (withdrawable), pending Add Cash
 * requests and the double-entry transaction history
 * (ADD_MONEY / JOIN_FEE / REFUND / WINNING_PRIZE / WITHDRAWAL).
 *
 * Pull down anywhere to refresh balances + ledger (no app restart needed).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(
    viewModel: PlayerViewModel,
    onBack: () -> Unit,
) {
    val state = viewModel.walletUi
    val deposits = (viewModel.myDepositsUi as? UiState.Success)?.data

    var showWithdraw by remember { mutableStateOf(false) }
    var showDeposit by remember { mutableStateOf(false) }
    var showAddMoney by remember { mutableStateOf(false) }
    var showLowWinningAlert by remember { mutableStateOf(false) }
    val haptics = androidx.compose.ui.platform.LocalHapticFeedback.current

    LaunchedEffect(Unit) { viewModel.loadMyDeposits() }

    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    androidx.compose.runtime.DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
                viewModel.refreshWallet(silent = true)
                viewModel.loadMyDeposits()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "Wallet", onBack = onBack)

            PullToRefreshBox(
                isRefreshing = viewModel.isWalletRefreshing,
                onRefresh = {
                    haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                    viewModel.refreshWallet()
                    viewModel.loadMyDeposits()
                },
                modifier = Modifier.fillMaxSize(),
            ) {
                when (state) {
                    UiState.Idle, UiState.Loading -> LoadingState("Loading wallet…")
                    is UiState.Error -> ErrorState(state.message) { viewModel.refreshWallet() }
                    is UiState.Success -> WalletContent(
                        wallet = state.data,
                        deposits = deposits,
                        supportWhatsapp = viewModel.liveSettings.supportWhatsapp,
                        onAddMoney = {
                            viewModel.clearTopUp()
                            viewModel.clearDeposit()
                            showAddMoney = true
                        },
                        onWithdraw = {
                            if (state.data.winningValue >= 50) {
                                showWithdraw = true
                            } else {
                                showLowWinningAlert = true
                            }
                        },
                    )
                }
            }
        }
    }

    if (showAddMoney) {
        AddMoneySheet(
            viewModel = viewModel,
            onDismiss = { showAddMoney = false },
            onManualDeposit = {
                showAddMoney = false
                viewModel.clearDeposit()
                showDeposit = true
            },
        )
    }

    if (showDeposit) {
        DepositModal(
            viewModel = viewModel,
            upiId = viewModel.liveSettings.upiId.ifBlank { viewModel.config.upiId },
            upiName = viewModel.liveSettings.payeeName,
            minDeposit = viewModel.liveSettings.minDeposit,
            onDismiss = { showDeposit = false },
        )
    }

    if (showLowWinningAlert) {
        AlertDialog(
            onDismissRequest = { showLowWinningAlert = false },
            title = { Text("Minimum ₹50 Winning Required", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Winning balance is withdrawable money earned from matches. " +
                        "Join a paid tournament, win prizes and your winnings will appear here. " +
                        "Add Cash top-ups go to your Deposit Balance (entry fees) instead.",
                    style = MaterialTheme.typography.bodyMedium,
                )
            },
            confirmButton = {
                TextButton(onClick = { showLowWinningAlert = false }) { Text("Got it") }
            },
        )
    }

    if (showWithdraw && state is UiState.Success) {
        WithdrawalModal(
            winningBalance = state.data.winningValue,
            viewModel = viewModel,
            onDismiss = { showWithdraw = false },
        )
    }
}

@Composable
private fun WalletContent(
    wallet: WalletSummary,
    deposits: PlayerDepositsResponse?,
    supportWhatsapp: String,
    onAddMoney: () -> Unit,
    onWithdraw: () -> Unit,
) {
    val context = LocalContext.current
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                BalanceCard(
                    label = "Deposit Balance",
                    value = wallet.depositValue,
                    subtext = "For match entry fees",
                    tint = if (MaterialTheme.colorScheme.background.luminance() < 0.5f) Color(0xFF66BB6A) else Color(0xFF2E7D32),
                    currencyIcon = TournamentArt.diamond,
                    modifier = Modifier.weight(1f),
                )
                BalanceCard(
                    label = "Winning Balance",
                    value = wallet.winningValue,
                    subtext = "Withdrawable to UPI",
                    tint = Color(0xFF0288D1),
                    currencyIcon = TournamentArt.goldCoin,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        deposits?.let { history ->
            if (history.pendingValue > 0) {
                item {
                    GlassCard(cornerRadius = 12.dp, modifier = Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("⏳", fontSize = 16.sp)
                            Column(modifier = Modifier.weight(1f).padding(start = 8.dp)) {
                                Text(
                                    "₹${formatMoney(history.pendingValue)} Add Cash under verification",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    "Balance is credited after staff verify your UTR",
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                AppButton(
                    text = "➕ Add Cash",
                    onClick = onAddMoney,
                    modifier = Modifier.weight(1f),
                )
                AppButton(
                    text = "💸 Withdraw",
                    onClick = onWithdraw,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        if (supportWhatsapp.isNotBlank()) {
            item {
                GlassCard(cornerRadius = 12.dp, modifier = Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("💬", fontSize = 16.sp)
                        Column(modifier = Modifier.weight(1f).padding(start = 8.dp)) {
                            Text(
                                "Need help with a deposit or withdrawal?",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                "Chat with support on WhatsApp",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        TextButton(onClick = {
                            val url = "https://wa.me/${supportWhatsapp.filter { it.isDigit() }}"
                            runCatching {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            }
                        }) { Text("Chat") }
                    }
                }
            }
        }

        item {
            Text(
                "Transactions (${wallet.pagination.total})",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
        }

        if (wallet.ledger.isEmpty()) {
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "No transactions yet. Add cash or join a match to get started.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        items(wallet.ledger, key = { it.id }) { entry -> LedgerRow(entry) }
    }
}

@Composable
private fun BalanceCard(
    label: String,
    value: Double,
    subtext: String,
    tint: Color,
    currencyIcon: Int,
    modifier: Modifier = Modifier,
) {
    GlassCard(modifier = modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            CurrencyIcon(currencyIcon, size = 13.dp)
            Text(
                " $label",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
            )
        }
        Text(
            "₹${formatMoney(value)}",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = tint,
        )
        Text(
            subtext,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 10.sp,
        )
    }
}

@Composable
private fun LedgerRow(entry: LedgerEntry) {
    GlassCard(cornerRadius = 12.dp, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        entry.categoryLabel,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    CategoryChip(entry.category)
                }
                entry.notes?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp,
                        maxLines = 1,
                    )
                }
                Text(
                    formatLedgerTime(entry.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = (if (entry.isCredit) "+" else "-") + "₹" + formatMoney(entry.amountValue),
                    color = if (entry.isCredit) {
                        if (MaterialTheme.colorScheme.background.luminance() < 0.5f) Color(0xFF66BB6A) else Color(0xFF2E7D32)
                    } else {
                        MaterialTheme.colorScheme.error
                    },
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
                Text(
                    "Bal: ₹${formatMoney(entry.balanceAfter.toDoubleOrNull() ?: 0.0)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp,
                )
            }
        }
    }
}

/** Small category chip — ADD_MONEY / JOIN_FEE / REFUND / PRIZE / WITHDRAWAL. */
@Composable
private fun CategoryChip(category: String) {
    // Dark theme needs the 400-level tones; light theme the 700/800 levels.
    val onDark = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val (label, tint) = when (category) {
        "ADD_MONEY" -> "DEPOSIT" to (if (onDark) Color(0xFF66BB6A) else Color(0xFF2E7D32))
        "JOIN_FEE" -> "ENTRY" to (if (onDark) Color(0xFFEF5350) else Color(0xFFB71C1C))
        "WINNING_PRIZE" -> "PRIZE" to (if (onDark) Color(0xFF26C6DA) else Color(0xFF00838F))
        "WITHDRAWAL" -> "PAYOUT" to (if (onDark) Color(0xFFFFA726) else Color(0xFFE65100))
        "REFUND" -> "REFUND" to (if (onDark) Color(0xFFAB47BC) else Color(0xFF6A1B9A))
        else -> category to (if (onDark) Color(0xFFB0BEC5) else Color(0xFF546E7A))
    }
    Surface(
        color = tint.copy(alpha = 0.14f),
        shape = MaterialTheme.shapes.extraSmall,
        modifier = Modifier.padding(start = 6.dp),
    ) {
        Text(
            label,
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            color = tint,
            modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp),
        )
    }
}

private fun formatLedgerTime(iso: String): String = try {
    java.time.Instant.parse(iso)
        .atZone(java.time.ZoneId.systemDefault())
        .format(java.time.format.DateTimeFormatter.ofPattern("dd MMM, hh:mm a"))
} catch (e: Exception) {
    iso
}
