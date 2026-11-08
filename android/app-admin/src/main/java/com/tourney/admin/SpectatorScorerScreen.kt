package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
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
import com.tourney.core.model.PayoutResponse
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMoney

private val LiveGreen = Color(0xFF00C853)
private val ReviewAmber = Color(0xFFFF9800)
private val DangerRed = Color(0xFFE53935)
private val DoneGrey = Color(0xFF78909C)

/** Matches the spectator can actually score right now. */
private val LIVE_STATUSES = setOf("LIVE")

/** "Match over, score not entered yet" backlog. Hidden unless explicitly asked for. */
private val REVIEW_STATUSES = setOf("UNDER_REVIEW")

/**
 * Spectator Scorer Console (canDistributePrize).
 *
 * The spectator watches the custom room from the spectator slot and records
 * verified kills + the final rank for each player, then settles everything with
 * one save.
 *
 * Phase 12.8 changes:
 *   - Only **LIVE** matches are listed by default (the old screen mixed in 20+
 *     stale UNDER_REVIEW rows, which looked like demo data).
 *   - **Rank and kills start at 0** — nothing is auto-ranked, so a half-finished
 *     console can never invent a Booyah winner.
 *   - A top-bar **Done buttons** switch reveals a `✓ Done` per player. Done
 *     drops the finished player into the bottom section; winners float to the top
 *     of it, so the running list only ever holds players still in the game.
 */
@Composable
fun SpectatorScorerScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    var selectedId by remember { mutableStateOf<String?>(null) }
    var showConfirm by remember { mutableStateOf(false) }
    var showSummary by remember { mutableStateOf(false) }
    /** Done buttons are opt-in: boss only needs them for early deaths. */
    var doneMode by remember { mutableStateOf(false) }
    /** Show the "match finished but never scored" backlog. */
    var showReview by remember { mutableStateOf(false) }

    val listState = viewModel.tournamentsUi
    val slotsState = viewModel.scorerSlotsUi
    val payoutState = viewModel.payoutUi

    // Load on entry, and also self-heal a stale error state from a previous visit.
    LaunchedEffect(Unit) { if (listState !is AdminUi.Success) viewModel.loadTournaments() }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(
            showBrandBadge = true,
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
                showReview = showReview,
                onToggleReview = { showReview = it },
                onSelect = {
                    selectedId = it.id
                    showSummary = false
                    doneMode = false
                    viewModel.loadScorerSlots(it.id)
                },
                onReload = { viewModel.loadTournaments() },
            )
        } else {
            ScorerConsole(
                viewModel = viewModel,
                selectedId = selectedId!!,
                slotsState = slotsState,
                payoutState = payoutState,
                doneMode = doneMode,
                onToggleDoneMode = { doneMode = it },
                onRequestSave = { showConfirm = true },
            )
        }
    }

    // Payout confirmation
    if (showConfirm && selectedId != null) {
        val players = viewModel.scorerParticipants
        val ranked = players.count { it.rank in 1..48 }
        val unranked = players.count { it.rank == 0 && !it.disqualified }
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text("Save results & complete match?") },
            text = {
                Text(
                    "Verified kills and ranks will be locked, every ranked player paid from the " +
                        "prize pool, and the match marked COMPLETED (it disappears from the players' " +
                        "Live section immediately).\n\n" +
                        "🎯 $ranked ranked  •  ❔ $unranked unranked (kills only)\n\n" +
                        "This cannot be undone.",
                )
            },
            confirmButton = {
                AppButton(
                    text = "Yes, save & pay",
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
            title = { Text("Results saved ✅") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Total paid: ₹${formatMoney(payout.totalPaid)}")
                    Text("Players paid: ${payout.playersPaid}")
                    Text("Match status: ${payout.status}", fontSize = 12.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Match is hidden from the players' Live section. Kills and ranks are now " +
                            "visible in Players & Rewards.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
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

// ─── Match picker: LIVE only (plus an opt-in review backlog) ─────────────

@Composable
private fun TournamentSelector(
    listState: AdminUi<TournamentListResponse>,
    showReview: Boolean,
    onToggleReview: (Boolean) -> Unit,
    onSelect: (Tournament) -> Unit,
    onReload: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "🎥 Live matches to score",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Open the custom room as spectator, then record verified kills here.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 11.sp,
            )
        }

        // Only LIVE by default. UNDER_REVIEW is the "finished but unscored" backlog.
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FilterChip(
                selected = !showReview,
                onClick = { onToggleReview(false) },
                label = { Text("🔴 LIVE", fontSize = 11.sp) },
            )
            FilterChip(
                selected = showReview,
                onClick = { onToggleReview(true) },
                label = { Text("🕓 Unscored backlog", fontSize = 11.sp) },
            )
        }

        when (listState) {
            AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading matches…")
            is AdminUi.Error -> ErrorState(listState.message) { onReload() }
            is AdminUi.Success -> {
                val all = listState.data.items
                val wanted = if (showReview) REVIEW_STATUSES else LIVE_STATUSES
                val selectable = all
                    .filter { it.status.name in wanted }
                    .filter { if (showReview) it.slotsBooked > 0 else true }
                    .sortedByDescending { it.matchNumber ?: 0 }

                if (selectable.isEmpty()) {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            if (showReview) "No unscored matches — everything is settled 🎉"
                            else "No match is LIVE right now.",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            if (showReview) {
                                "Matches appear here when they have seats but no results yet."
                            } else {
                                "A match shows up the moment it goes LIVE. If play has started but " +
                                    "the status is still old, use 🕓 Unscored backlog."
                            },
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 12.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(selectable, key = { it.id }) { t ->
                            Surface(
                                onClick = { onSelect(t) },
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            t.displayName,
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                        Text(
                                            "${t.slotsBooked}/${t.totalSlots} booked  •  " +
                                                "${t.status.name.replace('_', ' ')}",
                                            fontSize = 11.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    Text(
                                        if (showReview) "Score →" else "🔴 Score →",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (showReview) ReviewAmber else LiveGreen,
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

// ─── The console ─────────────────────────────────────────────────────────

@Composable
private fun ScorerConsole(
    viewModel: AdminViewModel,
    selectedId: String,
    slotsState: AdminUi<com.tourney.core.model.SlotsResponse>,
    payoutState: AdminUi<PayoutResponse>,
    doneMode: Boolean,
    onToggleDoneMode: (Boolean) -> Unit,
    onRequestSave: () -> Unit,
) {
    val players = viewModel.scorerParticipants
    val running = players.filter { !it.isDone }
    val finished = players
        .filter { it.isDone }
        // Winners first: ranked players by rank, then unranked by slot.
        .sortedWith(compareBy({ if (it.rank in 1..48) 0 else 1 }, { if (it.rank in 1..48) it.rank else 999 }, { it.slotNumber }))
    val ranked = players.count { it.rank in 1..48 }
    val flagged = players.count { it.disqualified }

    Column(modifier = Modifier.fillMaxSize()) {
        // ── Toolbar: Done-mode switch + counters ──
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "🎯 $ranked ranked  •  🚨 $flagged flagged",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "${running.size} running  •  ${finished.size} finished",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text("Done", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.width(6.dp))
            Switch(checked = doneMode, onCheckedChange = onToggleDoneMode)
        }

        when (slotsState) {
            AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading participants…")
            is AdminUi.Error -> ErrorState(slotsState.message) { viewModel.loadScorerSlots(selectedId) }
            is AdminUi.Success -> {
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 8.dp),
                ) {
                    if (running.isEmpty() && finished.isEmpty()) {
                        item {
                            GlassCard(modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    "Nobody has booked a seat yet — there is nothing to score.",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontSize = 12.sp,
                                )
                            }
                        }
                    }

                    if (running.isNotEmpty()) {
                        item { SectionHeader("🏃 Running (${running.size})", LiveGreen) }
                        items(running, key = { "run-${it.slotNumber}" }) { player ->
                            ScorerRow(
                                viewModel = viewModel,
                                player = player,
                                doneMode = doneMode,
                            )
                        }
                    }

                    if (finished.isNotEmpty()) {
                        item {
                            Spacer(Modifier.height(4.dp))
                            SectionHeader("✅ Finished (${finished.size})", DoneGrey)
                            Text(
                                "Winners stay on top — full record for the final payout.",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        items(finished, key = { "done-${it.slotNumber}" }) { player ->
                            FinishedRow(viewModel = viewModel, player = player)
                        }
                    }

                    item { Spacer(Modifier.height(6.dp)) }
                }

                // ── Sticky save bar ──
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    if (payoutState is AdminUi.Error) {
                        Text(
                            payoutState.message,
                            color = MaterialTheme.colorScheme.error,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(bottom = 6.dp),
                        )
                    }
                    AppButton(
                        text = if (viewModel.payoutRunning) {
                            "Saving…"
                        } else {
                            "💾 Save Results & Complete Match (${finished.size} finished)"
                        },
                        enabled = !viewModel.payoutRunning && players.isNotEmpty(),
                        onClick = onRequestSave,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, accent: Color) {
    Text(title, fontSize = 12.sp, fontWeight = FontWeight.Black, color = accent)
}

/** A player still being scored: kills stepper, rank box, hack toggle, optional Done. */
@Composable
private fun ScorerRow(
    viewModel: AdminViewModel,
    player: ScorerPlayer,
    doneMode: Boolean,
) {
    GlassCard(cornerRadius = 12.dp, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                "${player.slotNumber}",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(20.dp),
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    player.inGameName,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = if (player.disqualified) DangerRed else MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "UID ${player.inGameUid}",
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            // Kills stepper
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Kills", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(
                        onClick = { viewModel.updateKills(player.userId, -1) },
                        enabled = player.verifiedKills > 0,
                        contentPadding = PaddingValues(horizontal = 4.dp),
                        modifier = Modifier.width(30.dp),
                    ) { Text("−", fontSize = 15.sp, color = MaterialTheme.colorScheme.primary) }
                    Text(
                        "${player.verifiedKills}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                    )
                    TextButton(
                        onClick = { viewModel.updateKills(player.userId, +1) },
                        contentPadding = PaddingValues(horizontal = 4.dp),
                        modifier = Modifier.width(30.dp),
                    ) { Text("+", fontSize = 15.sp, color = MaterialTheme.colorScheme.primary) }
                }
            }

            // Rank — empty means unranked (0), never auto-filled.
            var rankText by remember(player.userId) {
                mutableStateOf(if (player.rank in 1..48) player.rank.toString() else "")
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Rank", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(
                    value = rankText,
                    onValueChange = { input ->
                        val digits = input.filter(Char::isDigit).take(2)
                        rankText = digits
                        viewModel.updateRank(player.userId, digits.toIntOrNull() ?: 0)
                    },
                    singleLine = true,
                    placeholder = { Text("—", fontSize = 12.sp) },
                    textStyle = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.width(52.dp).height(46.dp),
                )
            }

            // Hack flag
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Hack", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Switch(
                    checked = player.disqualified,
                    onCheckedChange = { viewModel.toggleDisqualify(player.userId) },
                )
            }
        }

        if (doneMode) {
            TextButton(
                onClick = { viewModel.markPlayerDone(player.userId) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("✓ Done — player finished", fontSize = 11.sp, color = LiveGreen)
            }
        }

        if (player.disqualified) {
            OutlinedTextField(
                value = player.disqualifyReason,
                onValueChange = { viewModel.updateDisqualifyReason(player.userId, it) },
                label = { Text("Reason (visible to players)", fontSize = 10.sp) },
                placeholder = { Text("e.g. Aim hack", fontSize = 10.sp) },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodySmall,
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            )
        }
    }
}

/** A finished player — locked, compact, one tap to send back to Running. */
@Composable
private fun FinishedRow(viewModel: AdminViewModel, player: ScorerPlayer) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = DoneGrey.copy(alpha = 0.16f),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (player.rank in 1..48) "#${player.rank}" else "—",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = if (player.rank == 1) ReviewAmber else DoneGrey,
                modifier = Modifier.width(28.dp),
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    player.inGameName,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = if (player.disqualified) DangerRed else MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "${player.verifiedKills} kill(s)  •  slot ${player.slotNumber}" +
                        if (player.disqualified) "  •  🚨 disqualified" else "",
                    fontSize = 9.5.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextButton(onClick = { viewModel.markPlayerRunning(player.userId) }) {
                Text("↩", fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
