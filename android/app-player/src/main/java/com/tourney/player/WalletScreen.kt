package com.tourney.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.LedgerEntry
import com.tourney.core.model.WalletSummary
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.BalanceChip

/**
 * Wallet — deposit + winning balances (withdrawable) and the double-entry
 * transaction history (JOIN_FEE / REFUND / WINNING_PRIZE / ADD_MONEY).
 */
@Composable
fun WalletScreen(
    viewModel: PlayerViewModel,
    onBack: () -> Unit,
) {
    val state = viewModel.walletUi

    LaunchedEffect(Unit) { if (state is UiState.Idle) viewModel.refreshWallet() }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(title = "Wallet", onBack = onBack)

        when (state) {
            UiState.Idle, UiState.Loading -> LoadingState("Loading wallet…")
            is UiState.Error -> ErrorState(state.message) { viewModel.refreshWallet() }
            is UiState.Success -> WalletContent(state.data, onRefresh = { viewModel.refreshWallet() })
        }
    }
}

@Composable
private fun WalletContent(wallet: WalletSummary, onRefresh: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                BalanceCard("Deposit Balance", wallet.depositValue, Color(0xFF1B5E20), Modifier.weight(1f))
                BalanceCard("Winning Balance", wallet.winningValue, Color(0xFF01579B), Modifier.weight(1f))
            }
        }
        item {
            Text("Transactions (${wallet.pagination.total})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        if (wallet.ledger.isEmpty()) {
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("No transactions yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        items(wallet.ledger, key = { it.id }) { entry -> LedgerRow(entry) }
    }
}

@Composable
private fun BalanceCard(label: String, value: Double, tint: Color, modifier: Modifier = Modifier) {
    GlassCard(modifier = modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        Text("₹${formatMoney(value)}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = tint)
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
                Text(entry.categoryLabel, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                entry.notes?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, maxLines = 1)
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
                    color = if (entry.isCredit) Color(0xFF1B5E20) else MaterialTheme.colorScheme.error,
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

private fun formatLedgerTime(iso: String): String = try {
    java.time.Instant.parse(iso)
        .atZone(java.time.ZoneId.systemDefault())
        .format(java.time.format.DateTimeFormatter.ofPattern("dd MMM, hh:mm a"))
} catch (e: Exception) {
    iso
}