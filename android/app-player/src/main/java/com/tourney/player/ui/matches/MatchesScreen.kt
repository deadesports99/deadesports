package com.tourney.player.ui.matches
import androidx.annotation.DrawableRes
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentStatus
import com.tourney.core.ui.formatMoney
import com.tourney.player.PlayerViewModel
import com.tourney.player.R
import com.tourney.player.UiState
import com.tourney.player.ui.common.BalancePill
import com.tourney.player.ui.common.DemoChip
import com.tourney.player.ui.common.SpartanCrest
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText
import java.time.Instant

/**
 * Matches tab — the approved demo's tournaments page, ported 1:1:
 * header, esports title row, filter chips, match cards and the join sheet.
 * All data comes from the real API through [PlayerViewModel].
 */
private val FEED_FILTERS = listOf("All Matches", "Solo", "Duo", "Squad", "Clash Squad (CS)")

// Same order, tags and artwork as the demo's ESPORTS_GAMES list.
private data class GameTitle(
    val name: String,
    val tag: String,
    val active: Boolean,
    @DrawableRes val logo: Int,
)

private val GAME_TITLES = listOf(
    GameTitle("FREE FIRE", "LIVE", true, R.drawable.game_freefire),
    GameTitle("BGMI", "SOON", false, R.drawable.game_bgmi),
    GameTitle("COD MOBILE", "SOON", false, R.drawable.game_codm),
    GameTitle("VALORANT M", "LOCKED", false, R.drawable.game_valorant),
)

/** Matches still worth showing in the lobby (finished/cancelled ones leave). */
private fun isLobbyMatch(t: Tournament): Boolean {
    if (t.isListedNow == false) return false
    return t.status in setOf(
        TournamentStatus.OPEN,
        TournamentStatus.UPCOMING,
        TournamentStatus.SLOTS_FULL,
        TournamentStatus.ROOM_REVEALED,
        TournamentStatus.LIVE,
    )
}

/** Joining stops 60s before kickoff — same rule as the API. */
private fun isEntryClosed(matchTimeIso: String): Boolean = try {
    Instant.parse(matchTimeIso).toEpochMilli() - System.currentTimeMillis() <= 60_000
} catch (e: Exception) {
    false
}

@Composable
fun MatchesScreen(
    viewModel: PlayerViewModel,
    onOpenWallet: () -> Unit,
    onOpenRoom: (String) -> Unit,
    onOpenScoreboard: (String) -> Unit,
    onToast: (String) -> Unit,
) {
    var selectedFilter by rememberSaveable { mutableStateOf(FEED_FILTERS.first()) }
    var selectedGame by rememberSaveable { mutableStateOf(GAME_TITLES.first().name) }
    var sheetMatch by remember { mutableStateOf<Tournament?>(null) }

    val feedState = viewModel.feedUi
    val walletState = viewModel.walletUi
    val balance = (walletState as? UiState.Success)?.data?.totalBalance?.toDoubleOrNull() ?: 0.0
    val tournaments = (feedState as? UiState.Success)?.data?.items.orEmpty().filter(::isLobbyMatch)

    val visible = remember(tournaments, selectedFilter) {
        when (selectedFilter) {
            "All Matches" -> tournaments
            "Clash Squad (CS)" -> tournaments.filter { it.gameMode == com.tourney.core.model.GameMode.CLASH_SQUAD }
            else -> tournaments.filter { it.matchTypeLabel == selectedFilter }
        }
    }

    val liveCount = tournaments.count { it.status == TournamentStatus.LIVE }
    val upcomingCount = tournaments.count { it.status != TournamentStatus.LIVE }

    Column(modifier = Modifier.fillMaxSize()) {
        // ── Header ───────────────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(DemoColors.Canvas.copy(alpha = 0.92f))
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SpartanCrest()
            Spacer(Modifier.width(10.dp))
            Text(
                "Spartan Arena",
                fontSize = DemoText.Title,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextPrimary,
                modifier = Modifier.weight(1f),
            )
            BalancePill(amount = "₹${formatMoney(balance)}", onClick = onOpenWallet)
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // ── Esports title selector ───────────────────────────────────
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        "SELECT ESPORTS TITLE",
                        fontSize = DemoText.Tiny,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextMuted,
                    )
                    Text(
                        "$liveCount Live • $upcomingCount Upcoming",
                        fontSize = DemoText.Tiny,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextMuted,
                    )
                }
            }
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    GAME_TITLES.forEach { game ->
                        GameTitleCard(
                            game = game,
                            selected = selectedGame == game.name,
                            onClick = {
                                if (game.active) {
                                    selectedGame = game.name
                                } else {
                                    onToast("${game.name} scrims unlocking next season!")
                                }
                            },
                        )
                    }
                }
            }

            // ── Filters ──────────────────────────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FEED_FILTERS.forEach { filter ->
                        DemoChip(
                            text = filter,
                            selected = selectedFilter == filter,
                            onClick = { selectedFilter = filter },
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
                        "MATCHES (${visible.size})",
                        fontSize = DemoText.Body,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextSecondary,
                    )
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { viewModel.refreshFeed() }
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
                            if (viewModel.isFeedRefreshing) " Refreshing..." else " Refresh",
                            fontSize = DemoText.Tiny,
                            fontWeight = FontWeight.Bold,
                            color = DemoColors.TextMuted,
                        )
                    }
                }
            }

            // ── Loading / empty / cards ──────────────────────────────────
            if (feedState is UiState.Loading && visible.isEmpty()) {
                item { LoadingCard("Loading the lobby...") }
            } else if (feedState is UiState.Error && visible.isEmpty()) {
                item { LoadingCard((feedState as UiState.Error).message, showSpinner = false) }
            } else if (visible.isEmpty()) {
                item { LoadingCard("No open matches right now. New scrims show up here the moment the organiser creates them.", showSpinner = false) }
            }

            items(visible, key = { it.id }) { tournament ->
                val joined = tournament.mySlot != null
                MatchCard(
                    tournament = tournament,
                    joined = joined,
                    onOpen = {
                        if (joined) {
                            if (tournament.roomUnlocked == true) onOpenRoom(tournament.id) else onOpenScoreboard(tournament.id)
                        } else {
                            viewModel.clearJoinError()
                            sheetMatch = tournament
                        }
                    },
                )
            }

            item { Spacer(Modifier.height(16.dp)) }
        }
    }

    // ── Join sheet ───────────────────────────────────────────────────────
    val openMatch = sheetMatch
    if (openMatch != null) {
        val me = (viewModel.meUi as? UiState.Success)?.data
        JoinMatchSheet(
            tournament = openMatch,
            balance = balance,
            joined = openMatch.mySlot != null,
            joining = viewModel.isJoiningMatch,
            errorText = viewModel.joinMatchError,
            entryClosed = isEntryClosed(openMatch.matchTime),
            defaultIgn = me?.inGameName.orEmpty(),
            defaultUid = me?.inGameUid.orEmpty(),
            onDismiss = {
                viewModel.clearJoinError()
                sheetMatch = null
            },
            onJoin = { ign, uid ->
                viewModel.joinMatch(openMatch.id, ign, uid) { result ->
                    sheetMatch = null
                    onToast("Slot #${result.slotNumber} confirmed!")
                }
            },
            onTopUp = {
                sheetMatch = null
                onOpenWallet()
            },
        )
    }
}

@Composable
private fun GameTitleCard(game: GameTitle, selected: Boolean, onClick: () -> Unit) {
    // demo: h-[52px] min-w-[155px] rounded-xl border px-3 py-1.5 gap-2.5
    Row(
        modifier = Modifier
            .widthIn(min = 155.dp)
            .height(52.dp)
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(
                if (selected) DemoColors.CardElevated else DemoColors.CardMuted
            )
            .alpha(if (selected) 1f else 0.45f)
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) DemoColors.TextPrimary else DemoColors.BorderSoft,
                shape = RoundedCornerShape(DemoRadius.Field),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // 32dp rounded logo tile, demo: h-8 w-8 rounded-lg bg-black/20 object-cover
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color.Black.copy(alpha = 0.2f)),
        ) {
            Image(
                painter = painterResource(id = game.logo),
                contentDescription = game.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }

        Column(modifier = Modifier.weight(1f, fill = false)) {
            Text(
                game.name,
                fontSize = DemoText.Small,
                fontWeight = FontWeight.Black,
                color = if (selected) DemoColors.TextPrimary else DemoColors.TextSecondary,
                letterSpacing = (-0.2).sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                modifier = Modifier.padding(top = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (game.active) {
                    val pulse = rememberInfiniteTransition(label = "livePulse")
                    val alpha by pulse.animateFloat(
                        initialValue = 1f,
                        targetValue = 0.25f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(900, easing = LinearEasing),
                            repeatMode = RepeatMode.Reverse,
                        ),
                        label = "liveDot",
                    )
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .alpha(alpha)
                            .clip(RoundedCornerShape(50))
                            .background(DemoColors.Success),
                    )
                    Text(
                        "LIVE NOW",
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.Success,
                    )
                } else {
                    Icon(
                        Icons.Filled.Lock,
                        contentDescription = null,
                        tint = DemoColors.TextMuted,
                        modifier = Modifier.size(8.dp),
                    )
                    Text(
                        game.tag,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextMuted,
                    )
                }
            }
        }
    }
}

@Composable
private fun LoadingCard(text: String, showSpinner: Boolean = true) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (showSpinner) {
            CircularProgressIndicator(
                modifier = Modifier.size(14.dp),
                color = DemoColors.Gold,
                strokeWidth = 2.dp,
            )
        }
        Text(text, fontSize = DemoText.Small, color = DemoColors.TextMuted)
    }
}
