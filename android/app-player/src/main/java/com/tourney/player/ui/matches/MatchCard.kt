package com.tourney.player.ui.matches

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Gamepad
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.tourney.core.model.MatchType
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentStatus
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * One match row — a 1:1 port of `components/tournaments/MatchCard.tsx`.
 * Same chips, same three-column stat strip, same slot bar and CTA colours.
 */
@Composable
fun MatchCard(
    tournament: Tournament,
    joined: Boolean,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val fillFraction = if (tournament.totalSlots <= 0) 0f
    else (tournament.slotsBooked.toFloat() / tournament.totalSlots).coerceIn(0f, 1f)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card.copy(alpha = 0.85f))
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
            .clickable(onClick = onOpen)
            .padding(14.dp),
    ) {
        // Map + mode chips, kickoff time on the right.
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Chip(text = tournament.mapLabel, iconColor = DemoColors.Cyan)
            Chip(text = "${tournament.matchTypeLabel} • ${tournament.mapLabel}", iconColor = DemoColors.TextMuted)
            Box(Modifier.weight(1f))
            Text(
                formatMatchTime(tournament.matchTime),
                fontSize = DemoText.Tiny,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
            )
        }

        Text(
            tournament.displayName,
            fontSize = DemoText.BodyStrong,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 8.dp),
        )

        // Prize pool / per kill / entry fee strip.
        Row(
            modifier = Modifier
                .padding(top = 10.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(DemoRadius.Field))
                .background(DemoColors.Field)
                .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            SmallStat("Prize Pool", "₹${formatMoney(tournament.prizePoolValue)}", Modifier.weight(1f))
            SmallStat(
                "Per Kill",
                if (tournament.perKillValue > 0) "₹${formatMoney(tournament.perKillValue)}" else "Win Only",
                Modifier.weight(1f),
            )
            SmallStat("Entry Fee", "₹${formatMoney(tournament.entryFeeValue)}", Modifier.weight(1f), alignEnd = true)
        }

        // Seat bar + CTA.
        Row(
            modifier = Modifier
                .padding(top = 12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Filled.People,
                            contentDescription = null,
                            tint = DemoColors.TextMuted,
                            modifier = Modifier.size(12.dp),
                        )
                        Text(
                            "  ${tournament.slotsBooked}/${tournament.totalSlots} Slots",
                            fontSize = DemoText.Tiny,
                            fontWeight = FontWeight.Bold,
                            color = DemoColors.TextSecondary,
                        )
                    }
                    Text(
                        "${tournament.remainingSlots} left",
                        fontSize = DemoText.Tiny,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextMuted,
                    )
                }
                Box(
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(DemoRadius.Pill))
                        .background(DemoColors.CardElevated),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fillFraction)
                            .height(6.dp)
                            .clip(RoundedCornerShape(DemoRadius.Pill))
                            .background(
                                Brush.horizontalGradient(listOf(DemoColors.Cyan, DemoColors.Cyan)),
                            ),
                    )
                }
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (joined) DemoColors.Success else DemoColors.Gold)
                    .clickable(onClick = onOpen)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Text(
                    when {
                        joined -> "Joined ✓"
                        tournament.status == TournamentStatus.LIVE -> "Watch live"
                        else -> "Join • ₹${formatMoney(tournament.entryFeeValue)}"
                    },
                    fontSize = DemoText.Small,
                    fontWeight = FontWeight.Black,
                    color = if (joined) DemoColors.TextPrimary else DemoColors.OnGold,
                )
            }
        }
    }
}

@Composable
private fun Chip(text: String, iconColor: androidx.compose.ui.graphics.Color) {
    val icon = when {
        text.startsWith("Bermuda") || text.startsWith("Purgatory") ||
            text.startsWith("Kalahari") || text.startsWith("Alpine") || text.startsWith("Nexterra") ->
            Icons.Filled.LocationOn
        else -> Icons.Filled.Gamepad
    }
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(DemoColors.CardElevated)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(10.dp))
        Text(
            " $text",
            fontSize = DemoText.Tiny,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextSecondary,
        )
    }
}

@Composable
private fun SmallStat(label: String, value: String, modifier: Modifier = Modifier, alignEnd: Boolean = false) {
    Column(modifier = modifier, horizontalAlignment = if (alignEnd) Alignment.End else Alignment.Start) {
        Text(
            label.uppercase(),
            fontSize = DemoText.Micro,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextMuted,
        )
        Text(
            value,
            fontSize = DemoText.Body,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextPrimary,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}
