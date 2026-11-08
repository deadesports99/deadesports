package com.tourney.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.AdminPlayerDetailPlayer
import com.tourney.core.model.LinkedAccount
import com.tourney.core.model.PlayerDetailResponse
import com.tourney.core.model.PlayerHistorySummary
import com.tourney.core.model.PlayerMatchHistory
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMoney

private val DangerRed = Color(0xFFE53935)
private val GoodGreen = Color(0xFF00C853)
private val WarnAmber = Color(0xFFFF9800)

/**
 * Phase 12.3 — Player detail. Opened by tapping a player in Player Management.
 * Shows wallet totals, every match the player joined (with the identity used at
 * join time), reward history, cheat signals and the accounts sharing their device.
 */
@Composable
fun AdminPlayerDetailScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
    onOpenMatch: (String) -> Unit = {},
) {
    var banConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.clearPlayerDetailFeedback() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            val detail = (viewModel.playerDetailUi as? AdminUi.Success)?.data
            AppTopBar(
                title = detail?.player?.displayName?.let { "Player $it" } ?: "Player Details",
                onBack = onBack,
            )

            viewModel.playerDetailMessage?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = GoodGreen,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
            viewModel.playerDetailError?.let {
                Text(
                    "⚠️ $it",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }

            when (val state = viewModel.playerDetailUi) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading player…")
                is AdminUi.Error -> ErrorState(state.message) {
                    viewModel.loadPlayerDetail(showSpinner = true)
                }
                is AdminUi.Success -> PlayerDetailBody(
                    viewModel = viewModel,
                    data = state.data,
                    onBanClick = { banConfirm = true },
                    onOpenMatch = onOpenMatch,
                )
            }
        }
    }

    val player = (viewModel.playerDetailUi as? AdminUi.Success)?.data?.player
    if (banConfirm && player != null) {
        val banning = !player.isBanned
        AlertDialog(
            onDismissRequest = { banConfirm = false },
            title = {
                Text(
                    if (banning) "🚫 Ban ${player.displayName}?" else "✅ Unban ${player.displayName}?",
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                Text(
                    if (banning) {
                        "Blocks the account from logging in and joining any match. Existing sessions " +
                            "stop on their next request. Balances and match history stay intact."
                    } else {
                        "The player can log in and join matches again."
                    },
                    fontSize = 13.sp,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    banConfirm = false
                    viewModel.setDetailPlayerBanned(player.id, banning)
                }) {
                    Text(
                        if (banning) "Ban Account" else "Unban Account",
                        color = if (banning) DangerRed else GoodGreen,
                        fontWeight = FontWeight.Bold,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { banConfirm = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun PlayerDetailBody(
    viewModel: AdminViewModel,
    data: PlayerDetailResponse,
    onBanClick: () -> Unit,
    onOpenMatch: (String) -> Unit,
) {
    val player = data.player
    val summary = data.history.summary
    val matches = data.history.matches.filter { m ->
        when (viewModel.playerHistoryFilter) {
            "paid" -> m.isPaid
            "won" -> m.prizeValue > 0
            "flagged" -> m.isDisqualified || m.bannedFromMatch || m.sharedDeviceInMatch
            else -> true
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item { IdentityCard(player, onBanClick) }
        item { MoneyCard(player) }
        item { StatsCard(summary) }

        if (data.linkedAccounts.isNotEmpty()) {
            item { LinkedAccountsCard(data.linkedAccounts) }
        }

        item {
            Spacer(Modifier.height(4.dp))
            Text(
                "🎮 Match history (${matches.size}/${matches.size + (data.history.matches.size - matches.size)})",
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                HistoryChip(viewModel, "all", "All")
                HistoryChip(viewModel, "paid", "✅ Paid")
                HistoryChip(viewModel, "won", "🏆 Won")
                HistoryChip(viewModel, "flagged", "🚨 Flagged")
            }
        }

        if (matches.isEmpty()) {
            item {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("No matches in this filter", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Text(
                        "This player has joined ${data.history.matches.size} match(es) in total.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        items(matches, key = { it.tournamentId }) { match ->
            HistoryRow(match = match, onClick = { onOpenMatch(match.tournamentId) })
        }
    }
}

@Composable
private fun HistoryChip(viewModel: AdminViewModel, value: String, label: String) {
    FilterChip(
        selected = viewModel.playerHistoryFilter == value,
        onClick = { viewModel.updatePlayerHistoryFilter(value) },
        label = { Text(label, fontSize = 11.sp) },
    )
}

@Composable
private fun IdentityCard(player: AdminPlayerDetailPlayer, onBanClick: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 14.dp, contentPadding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        player.playerCode ?: "No ID",
                        fontWeight = FontWeight.Black,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    if (player.isBanned) {
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "🚫 BANNED",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = DangerRed,
                        )
                    }
                }
                Text(
                    listOfNotNull(player.inGameName, player.name).joinToString(" • ")
                        .ifBlank { "Unnamed player" },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "🎮 UID ${player.inGameUid ?: "-"}  •  📱 ${player.phoneNumber}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "📅 ${player.accountAgeDays} day old account  •  🆔 ${player.deviceId ?: "no device"}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        AppButton(
            text = if (player.isBanned) "✅ Unban Account" else "🚫 Ban Account",
            onClick = onBanClick,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun MoneyCard(player: AdminPlayerDetailPlayer) {
    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 14.dp, contentPadding = 14.dp) {
        Text("💰 Money", fontWeight = FontWeight.Bold, fontSize = 12.sp)
        Spacer(Modifier.height(6.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text("Deposit", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("₹${formatMoney(player.depositValue)}", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            Column {
                Text("Winning", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("₹${formatMoney(player.winningValue)}", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            Column {
                Text("Net in/out", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    "${if (player.netValue >= 0) "+" else "-"}₹${formatMoney(kotlin.math.abs(player.netValue))}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (player.netValue >= 0) DangerRed else GoodGreen,
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        HorizontalDivider()
        Spacer(Modifier.height(8.dp))
        Text(
            "Added ₹${formatMoney(player.depositedValue)}  •  Withdrew ₹${formatMoney(player.withdrawnValue)}",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            "Won ₹${formatMoney(player.winningsValue)}  •  Spent on entries ₹${formatMoney(player.entrySpentValue)}",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun StatsCard(summary: PlayerHistorySummary) {
    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 14.dp, contentPadding = 14.dp) {
        Text("🎮 Playing record", fontWeight = FontWeight.Bold, fontSize = 12.sp)
        Spacer(Modifier.height(6.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Stat("Matches", summary.totalMatches.toString())
            Stat("Booyah", summary.booyahs.toString())
            Stat("Win %", "${summary.winRatePct}%")
        }
        Spacer(Modifier.height(6.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Stat("Kills", summary.totalKills.toString())
            Stat("Avg kills", summary.avgKills.toString())
            Stat("Won", "₹${formatMoney(summary.totalWonValue)}")
        }
        if (summary.disqualifications > 0 || summary.matchBans > 0 || summary.sharedDeviceMatches > 0) {
            Spacer(Modifier.height(8.dp))
            HorizontalDivider()
            Spacer(Modifier.height(8.dp))
            if (summary.sharedDeviceMatches > 0) {
                Text(
                    "🚨 ${summary.sharedDeviceMatches} match(es) with another account on the same device",
                    fontSize = 10.sp,
                    color = DangerRed,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            if (summary.disqualifications > 0) {
                Text(
                    "🚨 ${summary.disqualifications} disqualification(s)",
                    fontSize = 10.sp,
                    color = DangerRed,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            if (summary.matchBans > 0) {
                Text(
                    "🚫 Banned in ${summary.matchBans} match(es)",
                    fontSize = 10.sp,
                    color = WarnAmber,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: String) {
    Column {
        Text(label, fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun LinkedAccountsCard(accounts: List<LinkedAccount>) {
    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 14.dp, contentPadding = 14.dp) {
        Text(
            "🚨 Linked accounts (${accounts.size})",
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            color = DangerRed,
        )
        Text(
            "Other players who joined from the same device.",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(6.dp))
        accounts.forEach { account ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .background(DangerRed, CircleShape),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    account.displayName,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (account.isBanned) {
                    Text("🚫 ", fontSize = 9.sp)
                }
                Text(
                    "${account.sharedMatches} match(es)",
                    fontSize = 9.5.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun HistoryRow(match: PlayerMatchHistory, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        match.displayName,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (match.isDisqualified || match.bannedFromMatch || match.sharedDeviceInMatch) {
                        Spacer(Modifier.width(4.dp))
                        Text("🚨", fontSize = 9.sp)
                    }
                }
                Text(
                    "Slot ${match.slotNumber}  •  ${match.status.replace('_', ' ')}" +
                        (match.inGameUidAtJoin?.let { "  •  UID $it" } ?: ""),
                    fontSize = 9.5.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                when {
                    match.prizeValue > 0 -> Text(
                        "₹${formatMoney(match.prizeValue)}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (match.isPaid) GoodGreen else WarnAmber,
                    )
                    match.isPaid -> Text("paid", fontSize = 10.sp, color = GoodGreen)
                    else -> Text("—", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                match.rank?.let {
                    Text("rank $it", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
