package com.tourney.player.ui.matches

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.MatchStatusResponse
import com.tourney.core.model.ScoreboardRow
import com.tourney.core.network.ApiClient
import com.tourney.core.network.apiCall
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney
import com.tourney.player.ui.common.DemoBackground
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * 🏁 MATCH STATUS — what the organiser's spectator console verified for a match.
 *
 * Reached from two places:
 *  - a LIVE match card in the lobby ("View Status"),
 *  - a settled match in My Matches ("View Status").
 *
 * Reading order is deliberate: which match, what I got, then the full board —
 * placement, kills and prize for every player, so "kisne kitne kill kiye" is
 * answerable without asking support.
 */
@Composable
fun MatchStatusScreen(
    tournamentId: String,
    myUserId: String?,
    onBack: () -> Unit,
    /** The card that opened this screen already knows the match number. */
    matchNumberHint: Int? = null,
) {
    var state by remember { mutableStateOf<StatusState>(StatusState.Loading) }
    var reloadTick by remember { mutableStateOf(0) }
    var showPlayers by remember { mutableStateOf(false) }

    LaunchedEffect(tournamentId, reloadTick) {
        state = try {
            StatusState.Success(apiCall { ApiClient.tourneyApi.tournamentResults(tournamentId) })
        } catch (e: Exception) {
            StatusState.Error(e.message ?: "Could not load the match status")
        }
    }

    // "Who joined" is still useful while a live match has no published results.
    // System back must return to the status view, not pop the whole route.
    BackHandler(enabled = showPlayers) { showPlayers = false }
    if (showPlayers) {
        JoinedPlayersScreen(
            tournamentId = tournamentId,
            matchTitle = (state as? StatusState.Success)?.data?.tournament?.title?.takeIf { it.isNotBlank() },
            onBack = { showPlayers = false },
        )
        return
    }

    DemoBackground {
        Column(modifier = Modifier.fillMaxSize()) {
            // ── Top bar ─────────────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
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
                    "Match Status",
                    modifier = Modifier.weight(1f),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.TextPrimary,
                    maxLines = 1,
                )
                IconButton(onClick = { reloadTick++ }) {
                    Icon(
                        Icons.Filled.Refresh,
                        contentDescription = "Refresh",
                        tint = DemoColors.TextSecondary,
                    )
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(DemoColors.BorderFaint),
            )

            when (val current = state) {
                StatusState.Loading -> StatusMessage("Loading match status…", DemoColors.TextMuted)

                is StatusState.Error -> Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        current.message,
                        fontSize = DemoText.Tiny,
                        color = DemoColors.Danger,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(10.dp))
                    TinyChip("Try again") { reloadTick++ }
                }

                is StatusState.Success -> {
                    val data = current.data
                    val mine = data.rowFor(myUserId)

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        item { MatchStrip(data, matchNumberHint) }

                        if (mine != null) {
                            item { MyResultCard(mine) }
                        }

                        if (!data.hasResults) {
                            item {
                                ResultAwaitedCard(
                                    status = data.tournament.status,
                                    onOpenPlayers = { showPlayers = true },
                                )
                            }
                        } else {
                            item { TotalsRow(data) }

                            item {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(start = 10.dp, end = 10.dp, top = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        "RANK",
                                        modifier = Modifier.width(52.dp),
                                        fontSize = DemoText.Micro,
                                        fontWeight = FontWeight.Bold,
                                        color = DemoColors.TextFaint,
                                    )
                                    Text(
                                        "PLAYER",
                                        modifier = Modifier.weight(1f),
                                        fontSize = DemoText.Micro,
                                        fontWeight = FontWeight.Bold,
                                        color = DemoColors.TextFaint,
                                    )
                                    Text(
                                        "KILLS",
                                        modifier = Modifier.width(44.dp),
                                        fontSize = DemoText.Micro,
                                        fontWeight = FontWeight.Bold,
                                        color = DemoColors.TextFaint,
                                        textAlign = TextAlign.End,
                                    )
                                    Text(
                                        "PRIZE",
                                        modifier = Modifier.width(64.dp),
                                        fontSize = DemoText.Micro,
                                        fontWeight = FontWeight.Bold,
                                        color = DemoColors.TextFaint,
                                        textAlign = TextAlign.End,
                                    )
                                }
                            }

                            itemsIndexed(data.scoreboard) { index, row ->
                                ScoreRow(
                                    row = row,
                                    isMe = row.player?.id != null && row.player?.id == myUserId,
                                    isFirst = index == 0,
                                    isLast = index == data.scoreboard.lastIndex,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** "Which match is this?" — number, map • mode, kickoff, status pill. */
@Composable
private fun MatchStrip(data: MatchStatusResponse, matchNumberHint: Int? = null) {
    val tournament = data.tournament
    val status = tournament.status.uppercase()
    val pill = when (status) {
        "LIVE" -> "LIVE" to DemoColors.Danger
        "CANCELLED" -> "CANCELLED" to DemoColors.Danger
        "UNDER_REVIEW" -> "UNDER REVIEW" to DemoColors.Warning
        "COMPLETED", "SETTLED" -> "FINISHED" to DemoColors.TextMuted
        else -> "UPCOMING" to DemoColors.Cyan
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        (tournament.matchNumber ?: matchNumberHint)?.let { number ->
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(DemoColors.Cyan.copy(alpha = 0.14f))
                    .padding(horizontal = 7.dp, vertical = 3.dp),
            ) {
                Text(
                    number.toString(),
                    fontSize = DemoText.Small,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.Cyan,
                )
            }
            Spacer(Modifier.width(8.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${tournament.mapLabel} • ${tournament.matchTypeLabel}",
                fontSize = DemoText.BodyStrong,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                formatMatchTime(tournament.matchTime),
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
                modifier = Modifier.padding(top = 1.dp),
            )
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(DemoRadius.Pill))
                .background(pill.second.copy(alpha = 0.16f))
                .padding(horizontal = 9.dp, vertical = 4.dp),
        ) {
            Text(pill.first, fontSize = DemoText.Micro, fontWeight = FontWeight.Black, color = pill.second)
        }
    }
}

/** The player's own line, pulled out of the board so it is never missed. */
@Composable
private fun MyResultCard(row: ScoreboardRow) {
    val prize = row.prizeWon
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card)
            .border(1.dp, DemoColors.Gold.copy(alpha = 0.45f), RoundedCornerShape(DemoRadius.Card)),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "YOUR RESULT",
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Black,
                color = DemoColors.Gold,
                letterSpacing = 0.6.sp,
            )
            Spacer(Modifier.weight(1f))
            Text(
                row.ign,
                fontSize = DemoText.Tiny,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(DemoColors.Strip)
                .padding(horizontal = 12.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ResultCell(
                label = if (row.rank == 1) "Booyah" else "Placement",
                value = row.rank?.let { "Rank #$it" } ?: "Unranked",
                tint = if (row.rank == 1) DemoColors.Gold else DemoColors.TextPrimary,
            )
            Spacer(Modifier.weight(1f))
            ResultCell(label = "Kills", value = row.kills.toString())
            Spacer(Modifier.weight(1f))
            ResultCell(
                label = if (row.isPaid) "Prize paid" else "Prize",
                value = "₹${formatMoney(prize)}",
                tint = when {
                    row.isDisqualified -> DemoColors.Danger
                    prize > 0 -> DemoColors.Success
                    else -> DemoColors.TextSecondary
                },
                alignEnd = true,
            )
        }
        val note = when {
            row.isDisqualified -> row.disqualifyReason?.takeIf { it.isNotBlank() } ?: "Disqualified by the organiser."
            row.isApproved && prize > 0 -> "Prize credited to your winnings wallet."
            prize > 0 -> "Prize declared — payout is being processed."
            else -> "No prize for this match."
        }
        Text(
            note,
            fontSize = DemoText.Micro,
            fontWeight = FontWeight.Bold,
            color = if (row.isDisqualified) DemoColors.Danger else DemoColors.TextMuted,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}

/** Compact three-tile strip: how many scored, total kills, total prize. */
@Composable
private fun TotalsRow(data: MatchStatusResponse) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        listOf(
            "PLAYERS" to data.scoreboard.size.toString(),
            "KILLS" to data.totalKills.toString(),
            "PRIZE PAID" to "₹${formatMoney(data.totalPrize)}",
        ).forEach { (label, value) ->
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.Card.copy(alpha = 0.85f))
                    .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                    .padding(vertical = 7.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    value,
                    fontSize = DemoText.Body,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.TextPrimary,
                    maxLines = 1,
                )
                Text(
                    label,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.TextMuted,
                    maxLines = 1,
                )
            }
        }
    }
}

/** Empty board: nothing verified yet, with a way to still see the seat list. */
@Composable
private fun ResultAwaitedCard(status: String, onOpenPlayers: () -> Unit) {
    val cancelled = status.uppercase() == "CANCELLED"
    val live = status.uppercase() == "LIVE"
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
            .padding(horizontal = 16.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            when {
                live -> "🔴 Match is live"
                cancelled -> "Match cancelled"
                else -> "Result awaited"
            },
            fontSize = DemoText.BodyStrong,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextPrimary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            when {
                live ->
                    "Kills aur rank spectator verify karega — publish hote hi " +
                        "poora scoreboard yahan aa jayega."
                cancelled ->
                    "Ye match cancel ho gaya, isliye koi rank ya kill nahi hai. " +
                        "Entry fee wallet me refund kar di gayi hai."
                else ->
                    "Organiser abhi result verify kar raha hai. Payout hote hi rank, " +
                        "kills aur prize yahan dikhega."
            },
            fontSize = DemoText.Tiny,
            color = DemoColors.TextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 13.sp,
        )
        Spacer(Modifier.height(12.dp))
        TinyChip("View joined players", onOpenPlayers)
    }
}

/** One board line: placement badge | IGN (+ You) | kills | prize. */
@Composable
private fun ScoreRow(row: ScoreboardRow, isMe: Boolean, isFirst: Boolean, isLast: Boolean) {
    val shape = RoundedCornerShape(
        topStart = if (isFirst) DemoRadius.Field else 0.dp,
        topEnd = if (isFirst) DemoRadius.Field else 0.dp,
        bottomStart = if (isLast) DemoRadius.Field else 0.dp,
        bottomEnd = if (isLast) DemoRadius.Field else 0.dp,
    )
    val rankColor = when (row.rank) {
        1 -> DemoColors.Gold
        2, 3 -> DemoColors.Cyan
        null -> DemoColors.TextFaint
        else -> DemoColors.TextSecondary
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(if (isMe) DemoColors.CardElevated else DemoColors.Card.copy(alpha = 0.9f))
            .then(
                if (isMe) Modifier.border(1.dp, DemoColors.Gold.copy(alpha = 0.55f), shape)
                else Modifier.border(1.dp, DemoColors.BorderFaint, shape),
            )
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.width(46.dp), contentAlignment = Alignment.CenterStart) {
            Box(
                modifier = Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(rankColor.copy(alpha = 0.16f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    row.rank?.let { "#$it" } ?: "—",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = rankColor,
                )
            }
        }
        Spacer(Modifier.width(6.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.ign,
                    fontSize = DemoText.BodyStrong,
                    fontWeight = FontWeight.Bold,
                    color = if (row.isDisqualified) DemoColors.Danger else DemoColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (isMe) {
                    Text(
                        "  YOU",
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.Gold,
                    )
                }
            }
            if (row.isDisqualified) {
                Text(
                    "Disqualified",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.Danger,
                )
            } else if (!row.isApproved && row.prizeWon > 0) {
                Text(
                    "Payout pending",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.Warning,
                )
            }
        }
        Text(
            row.kills.toString(),
            modifier = Modifier.width(44.dp),
            fontSize = DemoText.BodyStrong,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextPrimary,
            textAlign = TextAlign.End,
        )
        Text(
            if (row.prizeWon > 0) "₹${formatMoney(row.prizeWon)}" else "—",
            modifier = Modifier.width(64.dp),
            fontSize = DemoText.BodyStrong,
            fontWeight = FontWeight.Black,
            color = if (row.prizeWon > 0) DemoColors.Success else DemoColors.TextFaint,
            textAlign = TextAlign.End,
            fontFamily = if (row.prizeWon > 0) FontFamily.Default else FontFamily.Monospace,
        )
    }
}

@Composable
private fun ResultCell(
    label: String,
    value: String,
    tint: Color = DemoColors.TextPrimary,
    alignEnd: Boolean = false,
) {
    Column(horizontalAlignment = if (alignEnd) Alignment.End else Alignment.Start) {
        Text(
            label.uppercase(),
            fontSize = DemoText.Micro,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextMuted,
        )
        Text(
            value,
            fontSize = DemoText.BodyStrong,
            fontWeight = FontWeight.Black,
            color = tint,
            maxLines = 1,
        )
    }
}

@Composable
private fun TinyChip(text: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.ChipBg)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
            .clickable(onClick = onClick)
            .padding(horizontal = 13.dp, vertical = 7.dp),
    ) {
        Text(text, fontSize = DemoText.Tiny, fontWeight = FontWeight.Black, color = DemoColors.TextSecondary)
    }
}

@Composable
private fun StatusMessage(text: String, color: Color) {
    Box(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, fontSize = DemoText.Small, color = color, textAlign = TextAlign.Center)
    }
}

/** Tiny three-state holder — this screen has no ViewModel of its own. */
private sealed interface StatusState {
    data object Loading : StatusState
    data class Error(val message: String) : StatusState
    data class Success(val data: MatchStatusResponse) : StatusState
}
