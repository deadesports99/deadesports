package com.tourney.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import com.tourney.core.ui.MapBanner
import com.tourney.core.ui.ModeBadge
import com.tourney.core.ui.StatusBadge
import com.tourney.core.ui.TournamentArt
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Tournament feed — high-res Free Fire map banners + mode badges, live slot
 * progress and the join / room / results actions.
 *
 * Pull down to refresh (the list also auto-refreshes on ON_RESUME).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TournamentFeedScreen(
    viewModel: PlayerViewModel,
    onOpenSlots: (String, String, String) -> Unit,
    onOpenRoom: (String) -> Unit,
    onOpenScoreboard: (String) -> Unit,
    onLogout: () -> Unit,
) {
    val state = viewModel.feedUi
    var pulling by remember { mutableStateOf(false) }

    LaunchedEffect(state) { if (state !is UiState.Loading) pulling = false }

    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    androidx.compose.runtime.DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
                viewModel.refreshFeed()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(
                title = "Tournaments",
                onBack = null,
                modifier = Modifier.fillMaxWidth(),
                actions = {
                    IconButton(onClick = onLogout) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                            contentDescription = "Logout",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
            )

            PullToRefreshBox(
                isRefreshing = pulling,
                onRefresh = {
                    pulling = true
                    viewModel.refreshFeed()
                },
                modifier = Modifier.weight(1f),
            ) {
                when (state) {
                    UiState.Idle, UiState.Loading -> LoadingState("Loading tournaments…")
                    is UiState.Error -> {
                        Column(
                            modifier = Modifier.fillMaxSize().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            Text(
                                text = "⚠️ ${state.message}",
                                color = MaterialTheme.colorScheme.error,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                modifier = Modifier.padding(bottom = 16.dp),
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Button(onClick = { viewModel.refreshFeed() }) {
                                    Text("Retry")
                                }
                                OutlinedButton(onClick = onLogout) {
                                    Text("Logout")
                                }
                            }
                        }
                    }
                    is UiState.Success -> {
                        val items = state.data.items
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            item {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        "🔥 Active Matches (${items.size})",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                    )
                                    Text(
                                        "Pull to refresh",
                                        fontSize = 10.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }

                            if (items.isEmpty()) {
                                item {
                                    EmptyMatchesCard(onRefresh = { viewModel.refreshFeed(forceLoading = true) })
                                }
                            }

                            items(items, key = { it.id }) { t ->
                                TournamentCard(
                                    tournament = t,
                                    onOpenSlots = { onOpenSlots(t.id, t.matchType.name, t.entryFeeValue.toString()) },
                                    onOpenRoom = { onOpenRoom(t.id) },
                                    onOpenScoreboard = { onOpenScoreboard(t.id) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Cupertino-grade empty state when nothing is scheduled. */
@Composable
private fun EmptyMatchesCard(onRefresh: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Text("🎮", fontSize = 34.sp)
        Text(
            "No matches scheduled right now",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "New Free Fire rooms drop every few hours. Pull down to refresh — or tap below.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp, bottom = 10.dp),
        )
        AppButton(text = "Refresh Matches", onClick = onRefresh, modifier = Modifier.fillMaxWidth())
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

    GlassCard(
        cornerRadius = 16.dp,
        contentPadding = 0.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        // ─── Official map artwork banner (edge-to-edge) ─────────────────
        MapBanner(
            mapType = tournament.mapType,
            height = 116.dp,
            overlay = {
                StatusBadge(
                    status = tournament.status,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(10.dp),
                )

                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ModeBadge(tournament.gameMode, size = 26.dp)
                        Text(
                            " ${TournamentArt.modeLabel(tournament.gameMode)}",
                            color = Color.White.copy(alpha = 0.92f),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Text(
                        tournament.title,
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        "🗺 ${TournamentArt.mapLabel(tournament.mapType)}  •  👥 ${tournament.matchType.name}",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 11.sp,
                    )
                }
            },
        )

        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Stats row (Prize Pool, Per Kill, Entry)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                StatBlock("Prize Pool", "₹${formatMoney(tournament.prizePoolValue)}", Color(0xFF00C853))
                StatBlock("Per Kill", "₹${formatMoney(tournament.perKillValue)}", Color(0xFFFFA000))
                StatBlock("Entry Fee", "₹${formatMoney(tournament.entryFeeValue)}", MaterialTheme.colorScheme.primary)
            }

            // Slots progress
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "Seats: ${tournament.slotsBooked}/${tournament.totalSlots} Booked",
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    tournament.mySlot?.let { slot ->
                        Text(
                            "✅ Booked: Seat #${slot.slotNumber}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF00C853),
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                        )
                    }
                }
                LinearProgressIndicator(
                    progress = { tournament.fillFraction },
                    modifier = Modifier.fillMaxWidth().height(6.dp),
                )
            }

            Text(
                "⏰ Match Time: ${formatMatchTime(tournament.matchTime)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                AppButton(
                    text = if (tournament.mySlot != null) "View Your Seat" else "Select Seat (48)",
                    onClick = onOpenSlots,
                    modifier = Modifier.weight(1f),
                )
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
private fun StatBlock(label: String, value: String, valueColor: Color = Color.Unspecified) {
    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = valueColor)
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
