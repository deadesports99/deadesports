package com.tourney.player

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.ScoreboardEntry
import com.tourney.core.model.ScoreboardHeader
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.MapBanner
import com.tourney.core.ui.ModeBadge
import com.tourney.core.ui.StatusBadge
import com.tourney.core.ui.TournamentArt
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney

/**
 * 🏆 OFFICIAL SCOREBOARD (player-facing)
 *
 * Spectator-verified results only — no screenshots, no disputes:
 *  • Golden Booyah #1 banner with total earnings
 *  • Top Fragger (most verified kills) showcase
 *  • Disqualification banner when hackers were caught in the room
 *  • Full ranking #1–#48 with medals, kills and prize won
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
        AppTopBar(
            title = "Official Scoreboard",
            onBack = onBack,
            actions = {
                TextButton(onClick = { viewModel.loadScoreboard(tournamentId) }) { Text("Refresh") }
            },
        )

        when (state) {
            UiState.Idle, UiState.Loading -> LoadingState("Loading official results…")
            is UiState.Error -> ErrorState(state.message) { viewModel.loadScoreboard(tournamentId) }
            is UiState.Success -> {
                val header = state.data.tournament
                val rows = state.data.scoreboard
                val played = rows.filter { !it.isDisqualified }
                val booyah = played.firstOrNull { it.rank == 1 }
                val topFragger = played.maxByOrNull { it.kills }?.takeIf { it.kills > 0 }
                val flagged = rows.count { it.isDisqualified }

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item { ScoreboardHero(header) }

                    if (flagged > 0) {
                        item { DisqualificationBanner(flagged) }
                    }

                    if (booyah != null) {
                        item { BooyahBanner(booyah) }
                    }

                    if (topFragger != null) {
                        item { TopFraggerBanner(topFragger) }
                    }

                    if (rows.isEmpty()) {
                        item {
                            GlassCard(modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    "No verified results published yet.",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    "Our staff sits in the custom room as an official spectator. " +
                                        "Kills, ranks and prizes appear here right after the match is scored.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    } else {
                        item {
                            Text(
                                "Full Rankings (${rows.size})",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        items(rows, key = { it.player?.id ?: it.hashCode() }) { entry ->
                            ScoreboardRow(entry)
                        }
                    }
                }
            }
        }
    }
}

/** Map banner header with mode badge, status, prize pool and per-kill. */
@Composable
private fun ScoreboardHero(header: ScoreboardHeader) {
    val mapType = header.mapType
    GlassCard(cornerRadius = 16.dp, contentPadding = 0.dp, modifier = Modifier.fillMaxWidth()) {
        val overlay: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit = {
            StatusBadge(
                status = header.status,
                modifier = Modifier.align(Alignment.TopEnd).padding(10.dp),
            )
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(
                    header.title,
                    color = Color.White,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    header.gameMode?.let { ModeBadge(it, size = 22.dp) }
                    mapType?.let {
                        Text(
                            "🗺 ${TournamentArt.mapLabel(it)}",
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 11.sp,
                        )
                    }
                    header.matchType?.let {
                        Text(
                            "  •  👥 ${it.name}",
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 11.sp,
                        )
                    }
                }
            }
        }

        if (mapType != null) {
            MapBanner(mapType = mapType, height = 108.dp, overlay = overlay)
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.85f))
                    .padding(14.dp),
            ) {
                Text(header.title, color = Color.White, fontWeight = FontWeight.Bold)
            }
        }

        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                Column {
                    Text("Prize Pool", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        "₹${formatMoney(header.prizePool.toDoubleOrNull() ?: 0.0)}",
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF00C853),
                    )
                }
                Column {
                    Text("Per Kill", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        "₹${formatMoney(header.perKillPrize.toDoubleOrNull() ?: 0.0)}",
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFFFA000),
                    )
                }
                header.matchTime?.let {
                    Column {
                        Text("Match", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(formatMatchTime(it), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            Text(
                "Verified live by our official room spectator — no screenshots needed.",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun BooyahBanner(entry: ScoreboardEntry) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier
                .background(
                    Brush.linearGradient(
                        listOf(Color(0xFFB8860B), Color(0xFFFFC107), Color(0xFF8D6E00)),
                    ),
                )
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text("🏆 BOOYAH!", fontSize = 22.sp, fontWeight = FontWeight.Black, color = Color(0xFF2B1B00))
            Text(
                entry.player?.inGameName ?: "Unknown",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF1A1100),
                textAlign = TextAlign.Center,
            )
            Text(
                "UID ${entry.player?.inGameUid ?: "-"}  •  ${entry.kills} kills",
                fontSize = 11.sp,
                color = Color(0xFF3B2A00),
            )
            Text(
                "Total earnings ₹${formatMoney(entry.prizeValue)}",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF104A16),
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun TopFraggerBanner(entry: ScoreboardEntry) {
    GlassCard(cornerRadius = 14.dp, modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("🎯", fontSize = 26.sp)
            Column(modifier = Modifier.weight(1f).padding(start = 10.dp)) {
                Text(
                    "TOP FRAGGER",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFFF6D00),
                )
                Text(
                    entry.player?.inGameName ?: "Unknown",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "UID ${entry.player?.inGameUid ?: "-"}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "${entry.kills}",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFFFF6D00),
                )
                Text("kills", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    "₹${formatMoney(entry.prizeValue)}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun DisqualificationBanner(count: Int) {
    Surface(
        color = Color(0xFFB71C1C).copy(alpha = 0.14f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("🚨", fontSize = 20.sp)
            Text(
                "  $count player${if (count > 1) "s were" else " was"} disqualified for hacking/teaming — " +
                    "their prize is voided. Fair play wins here.",
                fontSize = 11.sp,
                color = Color(0xFFB71C1C),
                fontWeight = FontWeight.SemiBold,
            )
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
                Text(
                    name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isHacker) Color(0xFFB71C1C) else MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "UID: $uid",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 11.sp,
                )
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
