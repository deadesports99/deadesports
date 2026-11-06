package com.tourney.player.ui.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.LedgerEntry
import com.tourney.core.ui.formatMoney
import com.tourney.player.AddMoneySheet
import com.tourney.player.PlayerViewModel
import com.tourney.player.UiState
import com.tourney.player.ui.common.DemoChip
import com.tourney.player.ui.common.DemoMessage
import com.tourney.player.ui.common.SpartanCrest
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

private val PASSBOOK_FILTERS = listOf("All", "Deposits", "Winnings", "Withdrawals", "Entries")

/** Ledger category → the demo's filter bucket. */
private fun bucketOf(entry: LedgerEntry): String = when (entry.category) {
    "ADD_MONEY" -> "Deposits"
    "WINNING_PRIZE" -> "Winnings"
    "WITHDRAWAL" -> "Withdrawals"
    "JOIN_FEE" -> "Entries"
    "REFUND" -> "Deposits"
    else -> "All"
}

private fun titleOf(entry: LedgerEntry): String = entry.notes?.takeIf { it.isNotBlank() } ?: when (entry.category) {
    "ADD_MONEY" -> "Added Cash"
    "JOIN_FEE" -> "Entry Fee"
    "WINNING_PRIZE" -> "Prize Payout"
    "WITHDRAWAL" -> "Withdrawal"
    "REFUND" -> "Refund"
    else -> entry.category
}

/**
 * Wallet tab — demo design: two money cards (deposit vs winnings), a filter row
 * and the real passbook. Balances and rows come from GET /wallet; Add Cash opens
 * the existing gateway sheet so money still moves through the API.
 */
@Composable
fun WalletScreen(
    viewModel: PlayerViewModel,
    onToast: (String) -> Unit,
) {
    var filter by rememberSaveable { mutableStateOf(PASSBOOK_FILTERS.first()) }
    var addCashOpen by remember { mutableStateOf(false) }
    var withdrawOpen by remember { mutableStateOf(false) }

    val walletState = viewModel.walletUi
    val wallet = (walletState as? UiState.Success)?.data
    val ledger = wallet?.ledger.orEmpty()
    val visible = remember(ledger, filter) {
        if (filter == "All") ledger else ledger.filter { bucketOf(it) == filter }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            // ── Header (balance hidden on the wallet page, like the demo) ──
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(DemoColors.Canvas.copy(alpha = 0.92f))
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SpartanCrest()
                Spacer(Modifier.width(10.dp))
                Text(
                    "Arena Wallet",
                    fontSize = DemoText.Title,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.TextPrimary,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    Icons.Filled.Refresh,
                    contentDescription = "Refresh wallet",
                    tint = DemoColors.TextMuted,
                    modifier = Modifier
                        .size(18.dp)
                        .clickable { viewModel.refreshWallet() },
                )
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Text(
                        "TOTAL BALANCE",
                        fontSize = DemoText.Tiny,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextMuted,
                    )
                }
                item {
                    Text(
                        "₹${formatMoney(wallet?.totalValue ?: 0.0)}",
                        fontSize = 34.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                    )
                }
                if (walletState is UiState.Error) {
                    item { DemoMessage((walletState as UiState.Error).message) }
                }

                // ── The two money cards ──────────────────────────────────
                item {
                    MoneyCard(
                        label = "DEPOSIT CASH",
                        amount = wallet?.depositValue ?: 0.0,
                        caption = "Use for entry fees",
                        actionLabel = "Add Cash",
                        filled = true,
                        onClick = { addCashOpen = true },
                    )
                }
                item {
                    MoneyCard(
                        label = "WINNINGS CASH",
                        amount = wallet?.winningValue ?: 0.0,
                        caption = "Withdraw to UPI (min ₹50)",
                        actionLabel = "Withdraw",
                        filled = false,
                        onClick = { withdrawOpen = true },
                    )
                }

                // ── Passbook ─────────────────────────────────────────────
                item {
                    Text(
                        "ACCOUNT PASSBOOK",
                        fontSize = DemoText.Body,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextSecondary,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        PASSBOOK_FILTERS.forEach { option ->
                            DemoChip(
                                text = option,
                                selected = filter == option,
                                onClick = { filter = option },
                            )
                        }
                    }
                }

                if (walletState is UiState.Loading && ledger.isEmpty()) {
                    item { LoadingRow("Loading your passbook...") }
                } else if (visible.isEmpty()) {
                    item { LoadingRow("No transactions in this filter yet.") }
                }

                items(visible.size, key = { index -> visible[index].id }) { index ->
                    PassbookRow(visible[index])
                }

                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }

    if (addCashOpen) {
        AddMoneySheet(
            viewModel = viewModel,
            onDismiss = { addCashOpen = false },
            onManualDeposit = { addCashOpen = false },
        )
    }

    if (withdrawOpen) {
        WithdrawSheet(
            viewModel = viewModel,
            onDismiss = {
                withdrawOpen = false
                viewModel.clearWithdraw()
            },
            onDone = { message -> onToast(message) },
        )
    }
}

@Composable
private fun MoneyCard(
    label: String,
    amount: Double,
    caption: String,
    actionLabel: String,
    filled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card.copy(alpha = 0.9f))
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontSize = DemoText.Tiny, fontWeight = FontWeight.Bold, color = DemoColors.TextMuted)
            Text(
                "₹${formatMoney(amount)}",
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextPrimary,
                modifier = Modifier.padding(top = 2.dp),
            )
            Text(caption, fontSize = DemoText.Micro, color = DemoColors.TextFaint, modifier = Modifier.padding(top = 2.dp))
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(if (filled) DemoColors.Gold else DemoColors.CardElevated)
                .border(
                    width = if (filled) 0.dp else 1.dp,
                    color = DemoColors.BorderStrong,
                    shape = RoundedCornerShape(10.dp),
                )
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 9.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (filled) Icons.Filled.Add else Icons.Filled.ArrowUpward,
                    contentDescription = null,
                    tint = if (filled) DemoColors.OnGold else DemoColors.TextPrimary,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    " $actionLabel",
                    fontSize = DemoText.Body,
                    fontWeight = FontWeight.Black,
                    color = if (filled) DemoColors.OnGold else DemoColors.TextPrimary,
                )
            }
        }
    }
}

@Composable
private fun PassbookRow(entry: LedgerEntry) {
    val credit = entry.isCredit
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Card.copy(alpha = 0.75f))
            .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(
                    if (credit) DemoColors.Success.copy(alpha = 0.16f) else DemoColors.Danger.copy(alpha = 0.14f)
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                if (credit) Icons.Filled.ArrowDownward else Icons.Filled.ArrowUpward,
                contentDescription = null,
                tint = if (credit) DemoColors.Success else DemoColors.Danger,
                modifier = Modifier.size(15.dp),
            )
        }
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(start = 10.dp),
        ) {
            Text(
                titleOf(entry),
                fontSize = DemoText.Body,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                formatLedgerTime(entry.createdAt) + " • " + entry.category.replace('_', ' '),
                fontSize = DemoText.Micro,
                color = DemoColors.TextFaint,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                (if (credit) "+" else "−") + "₹" + formatMoney(entry.amountValue),
                fontSize = DemoText.Body,
                fontWeight = FontWeight.Black,
                color = if (credit) DemoColors.Success else DemoColors.Danger,
            )
            Text(
                "Bal ₹${formatMoney(entry.balanceAfter.toDoubleOrNull() ?: 0.0)}",
                fontSize = DemoText.Micro,
                color = DemoColors.TextFaint,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun LoadingRow(text: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        CircularProgressIndicator(modifier = Modifier.size(14.dp), color = DemoColors.Gold, strokeWidth = 2.dp)
        Text(text, fontSize = DemoText.Small, color = DemoColors.TextMuted)
    }
}

/** "06 Nov, 04:00 PM" in IST, same format the rest of the app uses. */
private fun formatLedgerTime(iso: String): String = com.tourney.core.ui.formatMatchTime(iso)
