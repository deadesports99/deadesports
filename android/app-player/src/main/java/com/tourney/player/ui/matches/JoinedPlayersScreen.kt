package com.tourney.player.ui.matches

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.JoinedPlayerEntry
import com.tourney.core.model.JoinedPlayersResponse
import com.tourney.core.network.ApiClient
import com.tourney.core.network.apiCall
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMatchTime
import com.tourney.player.ui.common.DemoBackground
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * Public "who joined this match" list, opened from the `12/48 Slots · View all`
 * line on a match card.
 *
 * Reading order on purpose: the biggest number is how many seats are gone, then
 * one tall row per player so names are legible at arm's length on a 6" phone.
 * The backend sorts by join time, so position 1 is the first booking.
 */
@Composable
fun JoinedPlayersScreen(
    tournamentId: String,
    matchTitle: String?,
    onBack: () -> Unit,
) {
    var state by remember { mutableStateOf<UiStateLite<JoinedPlayersResponse>>(UiStateLite.Loading) }
    var reloadTick by remember { mutableStateOf(0) }
    var query by remember { mutableStateOf("") }

    LaunchedEffect(tournamentId, reloadTick) {
        state = UiStateLite.Loading
        state = try {
            UiStateLite.Success(apiCall { ApiClient.tourneyApi.tournamentPlayers(tournamentId) })
        } catch (e: Exception) {
            UiStateLite.Error(e.message ?: "Could not load the players")
        }
    }

    DemoBackground {
        Column(modifier = Modifier.fillMaxSize()) {
            // Own top bar instead of AppTopBar: the Material surface there picks up
            // a peach tonal tint that clashes with the navy/gold match UI.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(DemoColors.Canvas)
                    .statusBarsPadding()
                    .padding(start = 4.dp, end = 4.dp, top = 4.dp, bottom = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = DemoColors.TextPrimary,
                    )
                }
                Text(
                    "Joined Players",
                    modifier = Modifier.weight(1f),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                IconButton(onClick = { reloadTick++ }) {
                    Icon(Icons.Filled.Refresh, contentDescription = "Refresh", tint = DemoColors.TextSecondary)
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(DemoColors.BorderFaint),
            )

            when (val current = state) {
                UiStateLite.Loading -> LoadingState("Loading players…")
                is UiStateLite.Error -> ErrorState(current.message) { reloadTick++ }
                is UiStateLite.Success -> {
                    val data = current.data
                    val seatsLeft = (data.totalSlots - data.joined).coerceAtLeast(0)
                    val fill = if (data.totalSlots <= 0) 0f
                    else (data.joined.toFloat() / data.totalSlots).coerceIn(0f, 1f)

                    val visible = remember(data.players, query) {
                        val q = query.trim().lowercase()
                        if (q.isEmpty()) data.players
                        else data.players.filter { player ->
                            player.ign?.lowercase()?.contains(q) == true ||
                                player.slotNumber.toString() == q ||
                                "slot ${player.slotNumber}".contains(q)
                        }
                    }

                    // ── Header card: one clear seat count, status pill on the right ──
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp)
                            .padding(top = 12.dp, bottom = 10.dp)
                            .clip(RoundedCornerShape(DemoRadius.Card))
                            .background(DemoColors.Card.copy(alpha = 0.9f))
                            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
                            .padding(horizontal = 14.dp, vertical = 13.dp),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                matchTitle?.takeIf { it.isNotBlank() } ?: "Match seats",
                                modifier = Modifier.weight(1f),
                                fontSize = DemoText.BodyStrong,
                                fontWeight = FontWeight.Black,
                                color = DemoColors.TextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }

                        Spacer(Modifier.height(10.dp))

                        // “48 / 48 joined” with the seat status on the same baseline
                        // (no floating pill, so nothing can look off-centre).
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.Bottom,
                        ) {
                            Text(
                                "${data.joined}",
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Black,
                                color = DemoColors.TextPrimary,
                            )
                            Text(
                                " / ${data.totalSlots} joined",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = DemoColors.TextMuted,
                                modifier = Modifier.padding(bottom = 2.dp, start = 2.dp),
                            )
                            Spacer(Modifier.weight(1f))
                            Text(
                                if (seatsLeft == 0) "Full" else "$seatsLeft left",
                                modifier = Modifier.padding(bottom = 3.dp),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = if (seatsLeft == 0) DemoColors.Danger else DemoColors.Success,
                            )
                        }

                        Spacer(Modifier.height(8.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(DemoRadius.Pill))
                                .background(DemoColors.Track),
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(fill)
                                    .height(6.dp)
                                    .clip(RoundedCornerShape(DemoRadius.Pill))
                                    .background(if (seatsLeft == 0) DemoColors.Danger else DemoColors.Gold),
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Seat 1 joined earliest — list is in join order.",
                            fontSize = DemoText.Tiny,
                            color = DemoColors.TextFaint,
                        )
                    }

                    // ── Search ──
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp)
                            .padding(bottom = 10.dp)
                            .clip(RoundedCornerShape(DemoRadius.Field))
                            .background(DemoColors.Field)
                            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(
                            Icons.Filled.Search,
                            contentDescription = null,
                            tint = DemoColors.TextFaint,
                            modifier = Modifier.size(16.dp),
                        )
                        Box(modifier = Modifier.weight(1f)) {
                            if (query.isEmpty()) {
                                Text("Search name or slot number", fontSize = 13.sp, color = DemoColors.TextFaint)
                            }
                            BasicTextField(
                                value = query,
                                onValueChange = { query = it },
                                singleLine = true,
                                textStyle = TextStyle(
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = DemoColors.TextPrimary,
                                ),
                                cursorBrush = SolidColor(DemoColors.Gold),
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }

                    if (visible.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize().padding(24.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                if (data.players.isEmpty()) "Nobody has joined yet.\nSeats appear here as players book."
                                else "No player matches \"$query\".",
                                fontSize = DemoText.BodyStrong,
                                color = DemoColors.TextMuted,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                lineHeight = 20.sp,
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 24.dp),
                        ) {
                            item {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 6.dp),
                                ) {
                                    Text(
                                        "ORDER",
                                        modifier = Modifier.width(56.dp),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = DemoColors.TextFaint,
                                    )
                                    Text(
                                        "PLAYER",
                                        modifier = Modifier.weight(1f),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = DemoColors.TextFaint,
                                    )
                                    Text(
                                        "JOINED AT",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = DemoColors.TextFaint,
                                    )
                                }
                            }

                            itemsIndexed(visible, key = { _, player -> player.slotNumber }) { index, player ->
                                val isLast = index == visible.lastIndex
                                PlayerRow(player, isFirst = index == 0, isLast = isLast)
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * One seat: 64dp tall so the name is readable, the join-order badge on the
 * left and the booking time on the right.
 */@Composable
private fun PlayerRow(player: JoinedPlayerEntry, isFirst: Boolean, isLast: Boolean) {
    val shape = RoundedCornerShape(
        topStart = if (isFirst) DemoRadius.Field else 0.dp,
        topEnd = if (isFirst) DemoRadius.Field else 0.dp,
        bottomStart = if (isLast) DemoRadius.Field else 0.dp,
        bottomEnd = if (isLast) DemoRadius.Field else 0.dp,
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(DemoColors.Card.copy(alpha = 0.85f))
            .then(
                if (isFirst) Modifier.border(1.dp, DemoColors.BorderSoft, shape)
                else Modifier,
            )
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Join order — 1 means "booked first", independent of the seat number.
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(
                    when (player.position) {
                        1 -> DemoColors.Gold.copy(alpha = 0.20f)
                        2, 3 -> DemoColors.Cyan.copy(alpha = 0.14f)
                        else -> DemoColors.ChipBg
                    },
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "${player.position}",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                color = when (player.position) {
                    1 -> DemoColors.Gold
                    2, 3 -> DemoColors.Cyan
                    else -> DemoColors.TextMuted
                },
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                player.ign?.takeIf { it.isNotBlank() } ?: "Player ${player.slotNumber}",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = if (player.isBanned) DemoColors.Danger else DemoColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(3.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    "Slot ${player.slotNumber}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.Cyan,
                )
                if (player.isBanned) {
                    Text("• banned", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = DemoColors.Danger)
                } else if (player.position == 1) {
                    Text("• first to join", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = DemoColors.Gold)
                }
            }
        }

        player.joinedAt?.let {
            Text(
                formatMatchTime(it),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = DemoColors.TextFaint,
            )
        }
    }

    if (!isLast) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp)
                .height(1.dp)
                .background(DemoColors.BorderFaint),
        )
    }
}

/** Tiny three-state holder — this screen has no ViewModel of its own. */
private sealed interface UiStateLite<out T> {
    data object Loading : UiStateLite<Nothing>
    data class Error(val message: String) : UiStateLite<Nothing>
    data class Success<T>(val data: T) : UiStateLite<T>
}
