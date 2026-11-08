package com.tourney.player.ui.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.LedgerEntry
import com.tourney.core.ui.formatMoney
import com.tourney.player.PlayerViewModel
import com.tourney.player.UiState
import com.tourney.player.ui.common.SpartanCrest
import com.tourney.player.ui.theme.DemoColors

private val PASSBOOK_FILTERS = listOf("All", "Deposits", "Winnings", "Withdrawals", "Entries")

private val EMERALD_500 = Color(0xFF10B981)

/** Ledger category → the demo's filter bucket. */
private fun bucketOf(entry: LedgerEntry): String = when (entry.category) {
    "ADD_MONEY" -> "Deposits"
    "WINNING_PRIZE" -> "Winnings"
    "WITHDRAWAL" -> "Withdrawals"
    "JOIN_FEE" -> "Entries"
    "REFUND" -> "Deposits"
    else -> "All"
}

/** Which brand badge the row shows, mirroring the demo's renderBadge(). */
private fun badgeOf(entry: LedgerEntry): BadgeKind = when (entry.category) {
    "ADD_MONEY" -> BadgeKind.PHONEPE
    "WINNING_PRIZE" -> BadgeKind.FF_WIN
    "JOIN_FEE" -> BadgeKind.FF_ENTRY
    "WITHDRAWAL" -> BadgeKind.PAYTM
    "REFUND" -> BadgeKind.GPAY
    else -> BadgeKind.FF_ENTRY
}

/**
 * Demo-style row titles: "Added Cash", "Entry Fee | Purgatory Duo",
 * "Match Winnings | Bermuda", "Withdrawal to cutoff@ybl" - the raw server note
 * (with its payment id and "pending approval" tail) is not shown as-is.
 */
private fun titleOf(entry: LedgerEntry): String {
    val note = entry.notes?.trim().orEmpty()

    return when (entry.category) {
        "ADD_MONEY" -> when {
            note.contains("mock", ignoreCase = true) -> "Added Cash via UPI"
            note.contains("razorpay", ignoreCase = true) -> "Added Cash via Razorpay"
            note.isBlank() -> "Added Cash"
            else -> note.replace(Regex("[—–-]"), "|")
        }

        "JOIN_FEE" -> {
            val name = Regex("\"([^\"]+)\"").find(note)?.groupValues?.get(1)
            if (name != null) "Entry Fee | $name" else "Entry Fee"
        }

        "WINNING_PRIZE" -> {
            val name = Regex("\"([^\"]+)\"").find(note)?.groupValues?.get(1)
            if (name != null) "Match Winnings | $name" else "Prize Payout"
        }

        "WITHDRAWAL" -> {
            val upi = Regex("[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+").find(note)?.value
            if (upi != null) "Withdrawal to $upi" else "Withdrawal"
        }

        "REFUND" -> "Refund"
        else -> note.ifBlank { entry.categoryLabel }
    }
}

/** Coloured meta word + the IST time, like the demo's per-category row line. */
private fun metaLabel(entry: LedgerEntry): Pair<String, Color> = when (entry.category) {
    "WINNING_PRIZE" -> "Match Winnings" to Color(0xFFFBBF24)
    "JOIN_FEE" -> "Entry Fee" to Color(0xFF22D3EE)
    "ADD_MONEY" -> "Deposit Wallet" to Color(0xFF34D399)
    "WITHDRAWAL" -> "Instant UPI Payout" to Color(0xFFA78BFA)
    "REFUND" -> "Refund" to Color(0xFF34D399)
    else -> entry.categoryLabel to DemoColors.TextMuted
}

/**
 * Wallet tab — a 1:1 port of the demo's `WalletScreen.tsx`: the vault card with
 * the UPI stack and total balance, the two money cards (deposit / winnings) with
 * their own actions, then the grouped passbook with brand badges and per-row
 * closing balance. Balances come from GET /wallet; Add Cash still moves money
 * through the real gateway sheet.
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

    val deposit = wallet?.depositValue ?: 0.0
    val winnings = wallet?.winningValue ?: 0.0
    val total = wallet?.totalValue ?: (deposit + winnings)

    // Group by day: TODAY / YESTERDAY / "06 NOV 2025"
    val groups = remember(visible) { groupByDay(visible) }

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
                Spacer(Modifier.size(10.dp))
                Text(
                    "Arena Wallet",
                    fontSize = 15.sp,
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
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                // ── 1. Premium arena vault card ──────────────────────────
                item {
                    VaultCard(
                        total = total,
                        deposit = deposit,
                        winnings = winnings,
                        onAddCash = { addCashOpen = true },
                        onWithdraw = { withdrawOpen = true },
                    )
                }

                if (walletState is UiState.Error) {
                    item {
                        Text(
                            (walletState as UiState.Error).message,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = DemoColors.Danger,
                        )
                    }
                }

                // ── 4. Passbook header + filters ────────────────────────
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            "ACCOUNT PASSBOOK",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            color = DemoColors.TextSecondary,
                            letterSpacing = 0.4.sp,
                        )
                        Text(
                            "Tap for receipt",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            color = DemoColors.TextMuted,
                        )
                    }
                }
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        PASSBOOK_FILTERS.forEach { option ->
                            FilterTab(
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
                    item { EmptyPassbook() }
                } else {
                    groups.forEach { (label, entries) ->
                        item(key = "group-$label") {
                            LedgerGroup(label = label, entries = entries)
                        }
                    }
                }

                item { Spacer(Modifier.height(8.dp)) }
            }
        }
    }

    if (addCashOpen) {
        AddCashSheet(
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

// ── Vault card ──────────────────────────────────────────────────────────
@Composable
private fun VaultCard(
    total: Double,
    deposit: Double,
    winnings: Double,
    onAddCash: () -> Unit,
    onWithdraw: () -> Unit,
) {
    val dark = DemoColors.isDark

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(
                if (dark) {
                    Brush.linearGradient(listOf(Color(0xFF0F1E36), Color(0xFF0B1526), Color(0xFF070D18)))
                } else {
                    Brush.linearGradient(listOf(Color.White, Color(0xFFF8FAFC), Color(0xFFF1F5F9)))
                }
            )
            .border(
                1.dp,
                if (dark) Color(0x33FFFFFF) else Color(0x330F172A),
                RoundedCornerShape(16.dp),
            )
            .padding(16.dp),
    ) {
        // Total balance row: UPI stack left, balance right (border-b pb-3)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            UpiStack()

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "TOTAL BALANCE",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (dark) Color(0xFF94A3B8) else Color(0xFF64748B),
                    letterSpacing = 0.8.sp,
                )
                Text(
                    "₹${formatMoney(total)}",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.TextPrimary,
                    letterSpacing = (-0.5).sp,
                    modifier = Modifier.padding(top = 1.dp),
                )
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(if (dark) Color(0x26FFFFFF) else Color(0x260F172A)),
        )

        // Deposit / winnings cards
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            MoneyCard(
                label = "DEPOSIT CASH",
                labelColor = DemoColors.TextMuted,
                amount = deposit,
                amountColor = DemoColors.TextPrimary,
                emerald = false,
                actionLabel = "Add Cash",
                onAction = onAddCash,
                modifier = Modifier.weight(1f),
            )
            MoneyCard(
                label = "WINNINGS CASH",
                labelColor = EMERALD_500,
                amount = winnings,
                amountColor = EMERALD_500,
                emerald = true,
                actionLabel = "Withdraw",
                onAction = onWithdraw,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun MoneyCard(
    label: String,
    labelColor: Color,
    amount: Double,
    amountColor: Color,
    emerald: Boolean,
    actionLabel: String,
    onAction: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val dark = DemoColors.isDark

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (emerald) {
                    if (dark) {
                        Brush.verticalGradient(listOf(Color(0x6600221A), Color(0xB30B1526), Color(0xE60B1526)))
                    } else {
                        Brush.verticalGradient(listOf(Color(0xCCECFDF5), Color.White, Color.White))
                    }
                } else {
                    Brush.verticalGradient(
                        listOf(
                            if (dark) Color(0xB3020617) else Color.White,
                            if (dark) Color(0xB3020617) else Color.White,
                        )
                    )
                }
            )
            .border(
                1.dp,
                when {
                    emerald && dark -> Color(0x6610B981)   // emerald-500/40
                    emerald -> Color(0x4D059669)           // emerald-600/30
                    dark -> Color(0x33FFFFFF)              // white/20
                    else -> Color(0x330F172A)              // slate-900/20
                },
                RoundedCornerShape(12.dp),
            )
            .padding(12.dp),
    ) {
        Text(
            label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = labelColor,
            letterSpacing = 0.5.sp,
        )
        Text(
            "₹${formatMoney(amount)}",
            fontSize = 20.sp,
            fontWeight = FontWeight.Black,
            color = amountColor,
            letterSpacing = (-0.4).sp,
            modifier = Modifier.padding(top = 4.dp),
        )

        Box(
            modifier = Modifier
                .padding(top = 10.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(if (dark) Color(0xE6020617) else Color.White)
                .border(
                    1.dp,
                    if (dark) Color(0x40FFFFFF) else Color(0x400F172A),
                    RoundedCornerShape(8.dp),
                )
                .clickable(onClick = onAction)
                .padding(vertical = 6.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                actionLabel,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextPrimary,
            )
        }
    }
}

// ── Filters ─────────────────────────────────────────────────────────────
@Composable
private fun FilterTab(text: String, selected: Boolean, onClick: () -> Unit) {
    val dark = DemoColors.isDark
    val bg = when {
        selected && dark -> Color.White
        selected -> Color(0xFF020617)
        dark -> DemoColors.Card.copy(alpha = 0.8f)
        else -> Color.White
    }
    val border = when {
        selected -> if (dark) Color.White else Color(0xFF020617)
        dark -> DemoColors.BorderSoft
        else -> DemoColors.BorderSoft
    }
    val fg = when {
        selected -> if (dark) Color(0xFF020617) else Color.White
        else -> DemoColors.TextMuted
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 6.dp),
    ) {
        Text(
            text,
            fontSize = 12.sp,
            fontWeight = if (selected) FontWeight.Black else FontWeight.Bold,
            color = fg,
            maxLines = 1,
        )
    }
}

// ── Passbook ────────────────────────────────────────────────────────────
/** Demo's single continuous ledger container: rounded-2xl border, date header,
 *  then rows separated by 1dp dividers (not a card per row). */
@Composable
private fun LedgerGroup(label: String, entries: List<LedgerEntry>) {
    val dark = DemoColors.isDark
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(DemoColors.Card)
            .border(
                1.dp,
                if (dark) DemoColors.BorderSoft else Color(0xFFE2E8F0),
                RoundedCornerShape(16.dp),
            ),
    ) {
        GroupHeader(label = label, count = entries.size)
        entries.forEachIndexed { index, entry ->
            if (index > 0) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 56.dp)
                        .height(1.dp)
                        .background(if (dark) Color(0x0DFFFFFF) else Color(0xFFF1F5F9)),
                )
            }
            PassbookRow(entry)
        }
    }
}

@Composable
private fun GroupHeader(label: String, count: Int) {
    val dark = DemoColors.isDark
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (dark) Color(0xB30F172A) else Color(0xFFF8FAFC))
            .border(
                width = 1.dp,
                color = if (dark) DemoColors.BorderSoft else Color(0xFFF1F5F9),
                shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
            )
            .padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextMuted,
            letterSpacing = 0.8.sp,
        )
        Text(
            "$count ${if (count == 1) "RECORD" else "RECORDS"}",
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextFaint,
        )
    }
}

@Composable
private fun PassbookRow(entry: LedgerEntry) {
    val dark = DemoColors.isDark
    val credit = entry.isCredit
    val (meta, metaColor) = metaLabel(entry)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { }
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        BrandBadge(badgeOf(entry))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                titleOf(entry),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                modifier = Modifier.padding(top = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(meta, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = metaColor)
                Text("•", fontSize = 10.sp, color = DemoColors.TextFaint)
                Text(
                    com.tourney.core.ui.formatMatchTime(entry.createdAt),
                    fontSize = 10.sp,
                    color = DemoColors.TextMuted,
                )
            }
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                (if (credit) "+" else "-") + "₹" + formatMoney(entry.amountValue),
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = if (credit) EMERALD_500 else DemoColors.TextPrimary,
                maxLines = 1,
            )
            Text(
                "Bal: ₹${formatMoney(entry.balanceAfter.toDoubleOrNull() ?: 0.0)}",
                fontSize = 9.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
                color = DemoColors.TextFaint,
                modifier = Modifier.padding(top = 2.dp),
            )
        }

        Icon(
            Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = DemoColors.TextMuted.copy(alpha = 0.4f),
            modifier = Modifier.size(14.dp),
        )
    }
}

@Composable
private fun EmptyPassbook() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(DemoColors.Card.copy(alpha = 0.5f))
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(16.dp))
            .padding(vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("No passbook records found", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = DemoColors.TextMuted)
        Text(
            "Try selecting \"All\" or another category filter.",
            fontSize = 10.sp,
            color = DemoColors.TextFaint,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
private fun LoadingRow(text: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(DemoColors.Card)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        CircularProgressIndicator(modifier = Modifier.size(14.dp), color = DemoColors.Gold, strokeWidth = 2.dp)
        Text(text, fontSize = 11.sp, color = DemoColors.TextMuted)
    }
}

/** TODAY / YESTERDAY / "06 NOV 2025" buckets, newest first. */
private fun groupByDay(entries: List<LedgerEntry>): List<Pair<String, List<LedgerEntry>>> {
    val today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"))
    val order = mutableListOf<String>()
    val map = mutableMapOf<String, MutableList<LedgerEntry>>()

    entries.forEach { entry ->
        val date = runCatching {
            java.time.Instant.parse(entry.createdAt).atZone(java.time.ZoneId.of("Asia/Kolkata")).toLocalDate()
        }.getOrNull()

        val label = when {
            date == null -> "RECENT"
            date == today -> "TODAY"
            date == today.minusDays(1) -> "YESTERDAY"
            else -> date.format(java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy", java.util.Locale.ENGLISH)).uppercase()
        }
        if (!map.containsKey(label)) {
            order.add(label)
            map[label] = mutableListOf()
        }
        map.getValue(label).add(entry)
    }
    return order.map { it to map.getValue(it).toList() }
}
