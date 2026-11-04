package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.model.PayoutResponse
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.formatMoney
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState

/**
 * Spectator Scorer Console (canDistributePrize):
 * staff watched the match from the custom room's spectator slot and records
 * verified kills, Booyah ranks, and hacker flags for ALL 48 participants,
 * then pays everyone with ONE tap.
 */
@Composable
fun SpectatorScorerScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    var selectedId by remember { mutableStateOf<String?>(null) }
    var showConfirm by remember { mutableStateOf(false) }
    var showSummary by remember { mutableStateOf(false) }

    val listState = viewModel.tournamentsUi
    val slotsState = viewModel.scorerSlotsUi
    val payoutState = viewModel.payoutUi

    LaunchedEffect(Unit) { if (listState is AdminUi.Idle) viewModel.loadTournaments() }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(
            title = if (selectedId == null) "Spectator Scorer" else "Scoring Console",
            onBack = {
                if (selectedId != null) {
                    selectedId = null
                    showSummary = false
                } else onBack()
            },
        )

        if (selectedId == null) {
            TournamentSelector(
                listState = listState,
                onSelect = {
                    selectedId = it.id
                    showSummary = false
                    viewModel.loadScorerSlots(it.id)
                },
                onReload = { viewModel.loadTournaments() },
            )
        } else {
            // ─── Scorer console for the selected match ───────────────────
            Column(modifier = Modifier.fillMaxSize()) {
                when (slotsState) {
                    AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading 48 participants…")
                    is AdminUi.Error -> ErrorState(slotsState.message) { viewModel.loadScorerSlots(selectedId!!) }
                    is AdminUi.Success -> {
                        val players = viewModel.scorerParticipants
                        val ranked = players.count { it.rank in 1..48 }
                        val flagged = players.count { it.disqualified }

                        LazyColumn(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 12.dp),
                        ) {
                            item {
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        "🎯 $ranked ranked • 🚨 $flagged flagged • ${players.size}/48 present",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                    )
                                    Text(
                                        "Enter verified kills + rank from the spectator slot. Payout settles everything.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontSize = 12.sp,
                                    )
                                }
                            }
                            items(players, key = { it.userId }) { player ->
                                ScorerRow(viewModel = viewModel, player = player)
                            }
                            item { Spacer(Modifier.height(4.dp)) }
                        }

                        // Sticky bottom payout button
                        Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
                            when (payoutState) {
                                is AdminUi.Error -> Text(payoutState.message, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                                else -> {}
                            }
                            AppButton(
                                text = if (viewModel.payoutRunning) "Paying out…" else "💰 Distribute Prize & Complete Match",
                                enabled = !viewModel.payoutRunning && players.isNotEmpty(),
                                onClick = { showConfirm = true },
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                }
            }
        }
    }

    // Payout confirmation
    if (showConfirm && selectedId != null) {
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text("Distribute prizes now?") },
            text = {
                Text(
                    "Verified results will be locked, winners paid from the prize pool, " +
                        "and the match marked COMPLETED. This cannot be undone.",
                )
            },
            confirmButton = {
                AppButton(
                    text = "Yes, pay everyone",
                    onClick = {
                        showConfirm = false
                        viewModel.runPayout(selectedId!!)
                    },
                )
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false }) { Text("Cancel") }
            },
        )
    }

    // Payout summary
    val payout = (viewModel.payoutUi as? AdminUi.Success<PayoutResponse>)?.data
    if (showSummary && payout != null) {
        AlertDialog(
            onDismissRequest = { showSummary = false },
            title = { Text("Payout complete ✅") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Total paid: ₹${formatMoney(payout.totalPaid)}")
                    Text("Players paid: ${payout.playersPaid}")
                    Text("Match status: ${payout.status}", fontSize = 12.sp)
                }
            },
            confirmButton = {
                TextButton(onClick = { showSummary = false }) { Text("Done") }
            },
        )
    }

    // Auto-open summary when a payout succeeds
    LaunchedEffect(payoutState) {
        if (payoutState is AdminUi.Success && !showSummary) showSummary = true
    }
}

@Composable
private fun TournamentSelector(
    listState: AdminUi<TournamentListResponse>,
    onSelect: (Tournament) -> Unit,
    onReload: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Select a match to score (48 seats, spectator-verified)",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        when (listState) {
            AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading tournaments…")
            is AdminUi.Error -> ErrorState(listState.message) { onReload() }
            is AdminUi.Success -> {
                val selectable = listState.data.items.filter {
                    it.status.name in setOf("ROOM_REVEALED", "LIVE", "UNDER_REVIEW", "OPEN", "SLOTS_FULL")
                }
                if (selectable.isEmpty()) {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Text("No playable matches right now. Create or wait for bookings.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                        items(selectable, key = { it.id }) { t ->
                            androidx.compose.material3.Surface(
                                onClick = { onSelect(t) },
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(t.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                    Text(
                                        "${t.matchType.name} • ${t.mapType.name} • ${t.slotsBooked}/48 booked • ${t.status.name}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontSize = 12.sp,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScorerRow(viewModel: AdminViewModel, player: ScorerPlayer) {
    GlassCard(cornerRadius = 12.dp, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("#${player.slotNumber}", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    player.inGameName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (player.disqualified) Color(0xFFB71C1C) else MaterialTheme.colorScheme.onSurface,
                )
                Text("UID ${player.inGameUid}", style = MaterialTheme.typography.labelSmall, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            // Kills stepper
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Kills", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { viewModel.updateKills(player.userId, -1) }, enabled = player.verifiedKills > 0) { Text("−", fontSize = 16.sp, color = MaterialTheme.colorScheme.primary) }
                    Text("${player.verifiedKills}", fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.padding(horizontal = 2.dp))
                    TextButton(onClick = { viewModel.updateKills(player.userId, +1) }) { Text("+", fontSize = 16.sp, color = MaterialTheme.colorScheme.primary) }
                }
            }

            // Rank
            var rankText by remember(player.userId) { mutableStateOf(player.rank.toString()) }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Rank", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                androidx.compose.material3.OutlinedTextField(
                    value = rankText,
                    onValueChange = { input ->
                        rankText = input.filter(Char::isDigit).take(3)
                        rankText.toIntOrNull()?.let { if (it in 1..48) viewModel.updateRank(player.userId, it) }
                    },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.width(56.dp).height(44.dp),
                )
            }

            // Disqualify toggle
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Hack?", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Switch(
                    checked = player.disqualified,
                    onCheckedChange = { viewModel.toggleDisqualify(player.userId) },
                )
            }
        }

        // Reason is shown to the player on the official scoreboard.
        if (player.disqualified) {
            androidx.compose.material3.OutlinedTextField(
                value = player.disqualifyReason,
                onValueChange = { viewModel.updateDisqualifyReason(player.userId, it) },
                label = { Text("Disqualification reason (visible to players)") },
                placeholder = { Text("e.g. Aim hack / teaming with opponents") },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodySmall,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
        }
    }
}