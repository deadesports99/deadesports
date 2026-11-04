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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentStatus
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import java.time.Duration
import java.time.Instant
import com.tourney.core.ui.StatusBadge
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney

/**
 * Match Operations — every scheduled / live / finished match with the two
 * "boss buttons": ⚡ Sweep lifecycle now and 🛑 Cancel & refund all.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminMatchManagerScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    LaunchedEffect(Unit) { viewModel.loadMatchOps() }

    var cancelTarget by remember { mutableStateOf<Tournament?>(null) }
    var cancelReason by remember { mutableStateOf("Insufficient players") }
    var cloneTarget by remember { mutableStateOf<Tournament?>(null) }
    var cloneTime by remember { mutableStateOf("") }
    val haptics = androidx.compose.ui.platform.LocalHapticFeedback.current

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "Manage Matches", onBack = onBack)

            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                AppButton(
                    text = if (viewModel.opsSweeping) "⏳ Sweeping…" else "⚡ Sweep Lifecycle Now",
                    enabled = !viewModel.opsSweeping,
                    onClick = {
                        haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                        viewModel.sweepNow()
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    "Reveals rooms at T-15 and moves kicked-off matches to LIVE. The server does this every 60s anyway.",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                viewModel.opsMessage?.let {
                    Text("✅ $it", fontSize = 11.sp, color = Color(0xFF00C853), fontWeight = FontWeight.SemiBold)
                }
                viewModel.opsError?.let {
                    Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
                viewModel.cloneMessage?.let {
                    Text("✅ $it", fontSize = 11.sp, color = Color(0xFF00C853), fontWeight = FontWeight.SemiBold)
                }
                viewModel.cloneError?.let {
                    Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
            }

            PullToRefreshBox(
                isRefreshing = viewModel.isMatchOpsRefreshing,
                onRefresh = {
                    haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                    viewModel.loadMatchOps()
                },
                modifier = Modifier.weight(1f),
            ) {
                when (val state = viewModel.matchOpsUi) {
                    AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading matches…")
                    is AdminUi.Error -> ErrorState(state.message) { viewModel.loadMatchOps() }
                    is AdminUi.Success -> {
                        val matches = state.data.items
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            if (matches.isEmpty()) {
                                item {
                                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                                        Text("🎮 No matches yet", fontWeight = FontWeight.Bold)
                                        Text(
                                            "Create a match first — it will appear here with live slot fill.",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                            }
                            items(matches, key = { it.id }) { match ->
                                MatchOpsCard(
                                    match = match,
                                    cancelling = viewModel.opsBusyMatchId == match.id,
                                    cloning = viewModel.cloneBusyMatchId == match.id,
                                    onCancel = { cancelTarget = match },
                                    onClone = {
                                        viewModel.clearCloneFeedback()
                                        cloneTarget = match
                                        cloneTime = plusHours(match.matchTime, 1)
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    cancelTarget?.let { match ->
        AlertDialog(
            onDismissRequest = { cancelTarget = null },
            title = { Text("Cancel “${match.title}”?", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(
                        "This refunds all ${match.slotsBooked} booked entry fee(s) — " +
                            "₹${formatMoney(match.entryFeeValue * match.slotsBooked)} total — atomically to each " +
                            "player's wallet, flips the match to CANCELLED and pushes a notification.",
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = cancelReason,
                        onValueChange = { cancelReason = it.take(120) },
                        label = { Text("Reason (players see this)") },
                        isError = cancelReason.trim().length < 5,
                        supportingText = if (cancelReason.trim().length < 5) {
                            { Text("At least 5 characters") }
                        } else null,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    enabled = cancelReason.trim().length >= 5,
                    onClick = {
                        val id = match.id
                        cancelTarget = null
                        viewModel.cancelMatch(id, cancelReason)
                    },
                ) {
                    Text("Cancel & Refund", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { cancelTarget = null }) { Text("Keep match") }
            },
        )
    }

    cloneTarget?.let { match ->
        AlertDialog(
            onDismissRequest = { if (viewModel.cloneBusyMatchId == null) cloneTarget = null },
            title = { Text("📑 Clone match", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Copy ${match.title} into a fresh empty match. Choose the next start time:",
                        fontSize = 13.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { cloneTime = plusHours(match.matchTime, 1) }) { Text("+1 Hour") }
                        TextButton(onClick = { cloneTime = plusDays(match.matchTime, 1) }) { Text("Tomorrow") }
                    }
                    Text(
                        "New match: ${formatMatchTime(cloneTime)}",
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        "The cloned match keeps the map, mode, slots, entry fee and prize settings.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                AppButton(
                    text = if (viewModel.cloneBusyMatchId != null) "Cloning…" else "Create Clone",
                    enabled = viewModel.cloneBusyMatchId == null && cloneTime.isNotBlank(),
                    onClick = {
                        viewModel.cloneMatch(match.id, cloneTime)
                        cloneTarget = null
                    },
                )
            },
            dismissButton = {
                TextButton(
                    onClick = { cloneTarget = null },
                    enabled = viewModel.cloneBusyMatchId == null,
                ) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun MatchOpsCard(
    match: Tournament,
    cancelling: Boolean,
    cloning: Boolean,
    onCancel: () -> Unit,
    onClone: () -> Unit,
) {
    val canCancel = match.status !in setOf(
        TournamentStatus.COMPLETED,
        TournamentStatus.CANCELLED,
    )
    val canClone = match.status != TournamentStatus.CANCELLED

    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 16.dp, contentPadding = 14.dp) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    match.title,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "${match.matchType.name} • ${match.gameMode.name.replace('_', ' ')} • ₹${formatMoney(match.prizePoolValue)} pool",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            StatusBadge(status = match.status)
        }

        Spacer(Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("⏰ ${formatMatchTime(match.matchTime)}", fontSize = 10.sp)
            Text(
                "Seats ${match.slotsBooked}/${match.totalSlots}",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text("₹${formatMoney(match.entryFeeValue)} entry", fontSize = 10.sp)
        }

        Spacer(Modifier.height(6.dp))
        LinearProgressIndicator(
            progress = { match.fillFraction },
            modifier = Modifier.fillMaxWidth().height(5.dp),
        )

        Spacer(Modifier.height(12.dp))
        HorizontalDivider()
        Spacer(Modifier.height(10.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (canCancel) {
                AppButton(
                    text = if (cancelling) "⏳ Refunding…" else "🛑 Cancel & Refund",
                    enabled = !cancelling && !cloning,
                    onClick = onCancel,
                    modifier = Modifier.weight(1f),
                )
            }
            AppButton(
                text = if (cloning) "⏳ Cloning…" else "📑 Clone Match",
                enabled = canClone && !cancelling && !cloning,
                onClick = onClone,
                modifier = Modifier.weight(1f),
            )
            if (match.status == TournamentStatus.CANCELLED) {
                Text(
                    "Refunded",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 14.dp),
                )
            }
            Spacer(Modifier.width(2.dp))
        }
    }
}

private fun plusHours(iso: String, hours: Long): String = runCatching {
    Instant.parse(iso).plus(Duration.ofHours(hours)).toString()
}.getOrDefault(iso)

private fun plusDays(iso: String, days: Long): String = runCatching {
    Instant.parse(iso).plus(Duration.ofDays(days)).toString()
}.getOrDefault(iso)
