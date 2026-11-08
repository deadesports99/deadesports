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
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.Severity
import com.tourney.core.model.SuspiciousPlayer
import com.tourney.core.model.SuspicionSignal
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMoney

private val HighRed = Color(0xFFE53935)
private val MidAmber = Color(0xFFFF9800)
private val LowGrey = Color(0xFF78909C)

/**
 * Phase 12.4 — Cheat radar. Every account ranked by provable signals
 * (device farms, two accounts in one match, money taken out above money put in,
 * kill spikes, DQ history). Tap a row to open the full player 360.
 */
@Composable
fun AdminSuspiciousPlayersScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
    onOpenPlayer: (String) -> Unit,
) {
    LaunchedEffect(Unit) { viewModel.loadSuspiciousPlayers() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "🚨 Suspicious Players", onBack = onBack)

            when (val state = viewModel.suspiciousUi) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Scanning players…")
                is AdminUi.Error -> ErrorState(state.message) { viewModel.loadSuspiciousPlayers() }
                is AdminUi.Success -> {
                    val rows = state.data.rows
                    val high = rows.count { it.severity == Severity.HIGH }
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        item {
                            Text(
                                "${rows.size} flagged of ${state.data.scannedUsers} players scanned" +
                                    if (high > 0) " · $high need action" else "",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (high > 0) HighRed else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                ScoreChip(viewModel, 70, "🔴 High")
                                ScoreChip(viewModel, 40, "🟠 Medium")
                                ScoreChip(viewModel, 30, "🟡 All")
                                ScoreChip(viewModel, 0, "Everything")
                            }
                        }
                        if (rows.isEmpty()) {
                            item {
                                GlassCard(modifier = Modifier.fillMaxWidth()) {
                                    Text("✅ Nothing suspicious", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    Text(
                                        "No account crossed the ${state.data.minScore}-point threshold. " +
                                            "That is a good sign.",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                        items(rows, key = { it.userId }) { row ->
                            SuspiciousRow(row = row, onClick = { onOpenPlayer(row.userId) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScoreChip(viewModel: AdminViewModel, value: Int, label: String) {
    FilterChip(
        selected = viewModel.suspiciousMinScore == value,
        onClick = { viewModel.updateSuspiciousMinScore(value) },
        label = { Text(label, fontSize = 11.sp) },
    )
}

@Composable
private fun SuspiciousRow(row: SuspiciousPlayer, onClick: () -> Unit) {
    val accent = when (row.severity) {
        Severity.HIGH -> HighRed
        Severity.MEDIUM -> MidAmber
        Severity.LOW -> LowGrey
    }

    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(10.dp)) {
            // Score badge
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(accent.copy(alpha = 0.18f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        row.score.toString(),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = accent,
                    )
                    Text("score", fontSize = 7.sp, color = accent.copy(alpha = 0.75f))
                }
            }
            Spacer(Modifier.width(10.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        row.displayName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (row.isBanned) {
                        Spacer(Modifier.width(4.dp))
                        Text("🚫", fontSize = 9.sp)
                    }
                }
                Text(
                    buildString {
                        append("${row.stats.matchesJoined} match")
                        append("  •  ")
                        append("win ${row.stats.winRatePct}%")
                        append("  •  ")
                        append(
                            (if (row.stats.netOut >= 0) "+₹" else "-₹") +
                                formatMoney(kotlin.math.abs(row.stats.netOut)) + " net",
                        )
                    },
                    fontSize = 9.5.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(4.dp))
                row.signals.take(3).forEach { signal ->
                    SignalLine(signal = signal, accent = accent)
                }
                if (row.signals.size > 3) {
                    Text(
                        "+${row.signals.size - 3} more signal(s)",
                        fontSize = 9.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun SignalLine(signal: SuspicionSignal, accent: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(4.dp).background(accent, CircleShape))
        Spacer(Modifier.width(5.dp))
        Text(
            signal.label,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = accent,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
