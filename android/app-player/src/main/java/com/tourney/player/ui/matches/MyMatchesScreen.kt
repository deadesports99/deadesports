package com.tourney.player.ui.matches

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.MyMatchBucket
import com.tourney.core.model.MyMatchesSummary
import com.tourney.core.ui.formatMoney
import com.tourney.player.PlayerViewModel
import com.tourney.player.UiState
import com.tourney.player.ui.common.BalancePill
import com.tourney.player.ui.common.SpartanCrest
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * "My Matches" — the player's own record, one tab next to Tournaments.
 *
 * Careers strip, status filters, then one card per seat paid for. The lobby is
 * where you join; this screen only reports what happened (or what is about to).
 */
@Composable
fun MyMatchesScreen(
    viewModel: PlayerViewModel,
    onOpenWallet: () -> Unit,
    onOpenRoom: (String) -> Unit,
    onOpenStatus: (String, Int?) -> Unit,
    onBrowseTournaments: () -> Unit,
) {
    // First open loads the history; later opens just refresh what is already there.
    LaunchedEffect(Unit) { viewModel.refreshMyMatches() }

    val walletState = viewModel.walletUi
    val balance = (walletState as? UiState.Success)?.data?.totalBalance?.toDoubleOrNull() ?: 0.0

    val state = viewModel.myMatchesUi
    val page = (state as? UiState.Success)?.data
    val matches = page?.items.orEmpty()
    val summary = page?.summary
    val bucket = viewModel.myMatchesBucket

    Column(modifier = Modifier.fillMaxSize()) {
        // ── Header (same shell as the lobby) ────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(DemoColors.Canvas.copy(alpha = 0.92f))
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SpartanCrest()
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "My Matches",
                    fontSize = DemoText.Title,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.TextPrimary,
                )
                Text(
                    "Every match you joined • Results • Payouts",
                    fontSize = DemoText.Micro,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.TextMuted,
                )
            }
            BalancePill(amount = "₹${formatMoney(balance)}", onClick = onOpenWallet)
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                MyMatchesSummaryStrip(summary = summary)
            }

            // ── Status filters ───────────────────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    MyMatchBucket.entries.forEach { entry ->
                        BucketChip(
                            label = entry.label,
                            count = countFor(entry, summary),
                            selected = bucket == entry,
                            onClick = { viewModel.selectMyMatchesBucket(entry) },
                        )
                    }
                }
            }

            // ── List header ──────────────────────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "MATCHES (${matches.size})",
                        fontSize = DemoText.Body,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextSecondary,
                    )
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { viewModel.refreshMyMatches() }
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Filled.Refresh,
                            contentDescription = null,
                            tint = DemoColors.TextMuted,
                            modifier = Modifier.size(12.dp),
                        )
                        Text(
                            if (viewModel.isMyMatchesRefreshing) " Refreshing..." else " Refresh",
                            fontSize = DemoText.Tiny,
                            fontWeight = FontWeight.Bold,
                            color = DemoColors.TextMuted,
                        )
                    }
                }
            }

            // ── States ───────────────────────────────────────────────────
            if (state is UiState.Loading) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = DemoColors.Gold, strokeWidth = 2.dp)
                    }
                }
            }

            if (state is UiState.Error) {
                item {
                    EmptyBox(
                        title = "Could not load your matches",
                        hint = state.message,
                        actionLabel = "Try again",
                        onAction = { viewModel.refreshMyMatches(forceLoading = true) },
                    )
                }
            }

            if (state is UiState.Success && matches.isEmpty()) {
                item {
                    EmptyBox(
                        title = emptyTitle(bucket),
                        hint = emptyHint(bucket),
                        actionLabel = if (bucket == MyMatchBucket.ALL || bucket == MyMatchBucket.UPCOMING) "Browse tournaments" else null,
                        onAction = onBrowseTournaments,
                    )
                }
            }

            items(matches, key = { it.id }) { match ->
                MyMatchCard(
                    match = match,
                    onRoom = { onOpenRoom(match.id) },
                    // Live and settled matches both open the same scoreboard.
                    onStatus = { onOpenStatus(match.id, match.matchNumber) },
                )
            }

            // ── Load more ────────────────────────────────────────────────
            val info = page?.pagination
            if (info != null && info.page < info.totalPages) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(DemoRadius.Field))
                            .background(DemoColors.Card)
                            .clickable(enabled = !viewModel.isLoadingMoreMatches) {
                                viewModel.loadMoreMyMatches()
                            }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            if (viewModel.isLoadingMoreMatches) "Loading..." else "Load more matches",
                            fontSize = DemoText.Small,
                            fontWeight = FontWeight.Black,
                            color = DemoColors.TextSecondary,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MyMatchesSummaryStrip(summary: MyMatchesSummary?) {
    val tiles = listOf(
        "Played" to (summary?.matchesPlayed ?: 0).toString(),
        "Booyah" to (summary?.booyahs ?: 0).toString(),
        "Kills" to (summary?.totalKills ?: 0).toString(),
        "Won" to "₹${formatMoney(summary?.totalWinnings ?: 0.0)}",
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        tiles.forEach { (label, value) ->
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.Card.copy(alpha = 0.85f))
                    .padding(vertical = 8.dp, horizontal = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    value,
                    fontSize = DemoText.Small,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.TextPrimary,
                    maxLines = 1,
                )
                Text(
                    label.uppercase(),
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.TextMuted,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun BucketChip(label: String, count: Int, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .height(30.dp)
            .clip(RoundedCornerShape(DemoRadius.Pill))
            .background(if (selected) DemoColors.TextPrimary else DemoColors.Card)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            label,
            fontSize = DemoText.Tiny,
            fontWeight = if (selected) FontWeight.Black else FontWeight.Bold,
            color = if (selected) DemoColors.Canvas else DemoColors.TextSecondary,
        )
        if (count > 0) {
            Text(
                count.toString(),
                fontSize = 8.sp,
                fontWeight = FontWeight.Black,
                color = if (selected) DemoColors.Canvas.copy(alpha = 0.7f) else DemoColors.TextMuted,
            )
        }
    }
}

@Composable
private fun EmptyBox(
    title: String,
    hint: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Card)
            .padding(vertical = 22.dp, horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            title,
            fontSize = DemoText.Body,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextPrimary,
            textAlign = TextAlign.Center,
        )
        Text(
            hint,
            fontSize = DemoText.Tiny,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextMuted,
            textAlign = TextAlign.Center,
        )
        if (actionLabel != null && onAction != null) {
            Text(
                actionLabel,
                fontSize = DemoText.Tiny,
                fontWeight = FontWeight.Black,
                color = DemoColors.OnGold,
                modifier = Modifier
                    .padding(top = 4.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(DemoColors.Gold)
                    .clickable(onClick = onAction)
                    .padding(horizontal = 14.dp, vertical = 7.dp),
            )
        }
    }
}

private fun countFor(bucket: MyMatchBucket, summary: MyMatchesSummary?): Int = when (bucket) {
    MyMatchBucket.ALL -> summary?.matchesJoined ?: 0
    MyMatchBucket.UPCOMING -> summary?.upcomingCount ?: 0
    MyMatchBucket.LIVE -> summary?.liveCount ?: 0
    MyMatchBucket.COMPLETED -> summary?.completedCount ?: 0
    MyMatchBucket.CANCELLED -> summary?.cancelledCount ?: 0
}

private fun emptyTitle(bucket: MyMatchBucket): String = when (bucket) {
    MyMatchBucket.ALL -> "No matches played yet"
    MyMatchBucket.UPCOMING -> "No upcoming matches"
    MyMatchBucket.LIVE -> "Nothing live right now"
    MyMatchBucket.COMPLETED -> "No finished matches yet"
    MyMatchBucket.CANCELLED -> "No cancelled matches"
}

private fun emptyHint(bucket: MyMatchBucket): String = when (bucket) {
    MyMatchBucket.ALL -> "Join a tournament and your seat, rank, kills and prize money will show up here."
    MyMatchBucket.UPCOMING -> "New entries appear here as soon as you take a slot in the lobby."
    MyMatchBucket.LIVE -> "Matches you are playing appear here once the organiser starts them."
    MyMatchBucket.COMPLETED -> "Results and payouts show up after the organiser publishes them."
    MyMatchBucket.CANCELLED -> "If a match you paid for is cancelled, the refund appears here."
}
