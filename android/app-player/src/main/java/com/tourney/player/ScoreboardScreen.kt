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
import com.tourney.core.model.ScoreboardEntry
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState

/**
 * Official Spectator Scoreboard — verified by staff sitting in the room's
 * spectator slot. Rank 1-3 get medals, hackers show a red warning banner with
 * the disqualification reason. Prize zero = no payout.
 */
@Composable
fun ScoreboardScreen(
    tournamentId: String,
    viewModel: MatchViewModel,
    onBack: () -> Unit,
) {
    val state = viewModel.scoreboardUi

    LaunchedEffect(tournamentId) { viewModel.loadScoreboard(tournamentId) }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(title = "Spectator Scoreboard", onBack = onBack)

        when (state) {
            UiState.Idle, UiState.Loading -> LoadingState("Loading official results…")
            is UiState.Error -> ErrorState(state.message) { viewModel.loadScoreboard(tournamentId) }
            is UiState.Success -> {
                val header = state.data.tournament
                val rows = state.data.scoreboard

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Text(header.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Text(
                                "${header.status.name}  •  Prize Pool ₹${formatMoney(header.prizePool.toDoubleOrNull() ?: 0.0)}  •  ₹${formatMoney(header.perKillPrize.toDoubleOrNull() ?: 0.0)}/kill",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    if (rows.isEmpty()) {
                        item {
                            GlassCard(modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    "No verified results published yet. Staff scores appear here live.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }

                    items(rows, key = { it.player?.id ?: it.hashCode() }) { entry ->
                        ScoreboardRow(entry)
                    }
                }
            }
        }
    }
}

@Composable
private fun ScoreboardRow(entry: ScoreboardEntry) {
    val name = entry.player?.inGameName ?: "Unknown"
    val uid = entry.player?.inGameUid ?: "-"
    val medal = when (entry.rank) {
        1 -> "🥇"
        2 -> "🥈"
        3 -> "🥉"
        else -> if (entry.rank != null) "#${entry.rank}" else "—"
    }
    val isHacker = entry.isDisqualified

    GlassCard(cornerRadius = 14.dp, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(medal, fontSize = 18.sp, modifier = Modifier.padding(end = 4.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("UID: $uid", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                if (isHacker) {
                    Text(
                        "🚨 ${entry.disqualifyReason ?: "Disqualified (hacking/teaming)"} — prize voided",
                        color = Color(0xFFB71C1C),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("${entry.kills} kills", style = MaterialTheme.typography.titleSmall)
                Text(
                    "₹${formatMoney(entry.prizeValue)}",
                    style = MaterialTheme.typography.titleMedium,
                    color = if (isHacker) Color(0xFFB71C1C) else MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}