package com.tourney.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentStatus
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.StatusBadge
import com.tourney.core.ui.BalanceChip
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Tournament feed — active/upcoming matches with map/type, prize, entry, slots. */
@Composable
fun TournamentFeedScreen(
    viewModel: PlayerViewModel,
    onOpenSlots: (String, String) -> Unit,
    onOpenRoom: (String) -> Unit,
    onOpenScoreboard: (String) -> Unit,
    onLogout: () -> Unit,
) {
    val state = viewModel.feedUi

    LaunchedEffect(Unit) { if (state is UiState.Idle) viewModel.refreshFeed() }

    AppTopBar(
        title = "Matches",
        onBack = null,
        modifier = Modifier.fillMaxWidth(),
    )

    when (state) {
        UiState.Idle, UiState.Loading -> LoadingState("Loading matches…")
        is UiState.Error -> ErrorState(state.message, onRetry = { viewModel.refreshFeed() })
        is UiState.Success -> {
            val items = state.data.items
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                item {
                    Text(
                        "🏟 ${items.size} tournaments",
                        style = MaterialTheme.typography.titleLarge,
                    )
                }
                items(items, key = { it.id }) { t ->
                    TournamentCard(
                        tournament = t,
                        onOpenSlots = { onOpenSlots(t.id, t.matchType.name) },
                        onOpenRoom = { onOpenRoom(t.id) },
                        onOpenScoreboard = { onOpenScoreboard(t.id) },
                    )
                }
            }
        }
    }
}

@Composable
fun TournamentCard(
    tournament: Tournament,
    onOpenSlots: () -> Unit,
    onOpenRoom: () -> Unit,
    onOpenScoreboard: () -> Unit,
) {
    val canSeeRoom = tournament.mySlot != null && (
        tournament.status == TournamentStatus.ROOM_REVEALED ||
            tournament.status == TournamentStatus.LIVE ||
            tournament.status == TournamentStatus.UNDER_REVIEW
        )
    val hasResults = tournament.status in setOf(
        TournamentStatus.ROOM_REVEALED,
        TournamentStatus.LIVE,
        TournamentStatus.UNDER_REVIEW,
        TournamentStatus.COMPLETED,
    )

    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    tournament.title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                StatusBadge(tournament.status)
            }

            Text(
                "🗺 ${tournament.mapType.name}  •  ${tournament.matchType.name} Mode  •  ${tournament.gameMode.name}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                StatBlock("Prize Pool", "₹${formatMoney(tournament.prizePoolValue)}")
                StatBlock("Per Kill", "₹${formatMoney(tournament.perKillValue)}")
                StatBlock("Entry", "₹${formatMoney(tournament.entryFeeValue)}")
            }

            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "Slots ${tournament.slotsBooked}/${tournament.totalSlots}",
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = 12.sp,
                    )
                    if (tournament.mySlot != null) {
                        Text(
                            "Your seat: #${tournament.mySlot!!.slotNumber}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.tertiary,
                            fontSize = 12.sp,
                        )
                    }
                }
                LinearProgressIndicator(
                    progress = { tournament.fillFraction },
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                )
            }

            Text(
                "🕐 ${formatMatchTime(tournament.matchTime)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            HorizontalDivider()

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                AppButton(text = "View Slots", onClick = onOpenSlots, modifier = Modifier.weight(1f))
                if (canSeeRoom) {
                    AppButton(text = "Room ID", onClick = onOpenRoom, modifier = Modifier.weight(1f))
                }
                if (hasResults) {
                    AppButton(text = "Results", onClick = onOpenScoreboard, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun StatBlock(label: String, value: String) {
    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
        Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
    }
}

fun formatMoney(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString() else String.format("%.2f", value)

private val timeFormat: DateTimeFormatter =
    DateTimeFormatter.ofPattern("dd MMM, hh:mm a").withZone(ZoneId.systemDefault())

fun formatMatchTime(iso: String): String = try {
    timeFormat.format(Instant.parse(iso))
} catch (e: Exception) {
    iso
}