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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentStatus
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius

/**
 * One match row — a 1:1 port of `components/tournaments/MatchCard.tsx`:
 * map + mode chips (MapPin / Gamepad2), time on the right, the title, the
 * three-column prize / per-kill (Crosshair) / entry strip, then the seat bar
 * (Users) and the gold CTA. Colours come from the theme-aware demo palette.
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
        // ── Top: map chip, mode chip, kickoff time ──────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Chip(text = tournament.mapLabel, leading = Icons.Filled.Place, iconTint = DemoColors.Cyan)
            Chip(
                text = tournament.matchTypeLabel.uppercase(),
                leading = Icons.Filled.SportsEsports,
                iconTint = DemoColors.TextSecondary,
            )
            Box(Modifier.weight(1f))
            Text(
                formatMatchTime(tournament.matchTime),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
                maxLines = 1,
            )
        }

        // ── Title ───────────────────────────────────────────────────────
        Text(
            tournament.displayName,
            style = TextStyle(
                fontSize = 13.sp,
                lineHeight = 17.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = (-0.3).sp,
            ),
            color = DemoColors.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 8.dp),
        )

        // ── Prize pool / per kill / entry fee strip ─────────────────────
        Row(
            modifier = Modifier
                .padding(top = 10.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(DemoRadius.Field))
                .background(DemoColors.Strip)
                .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            StatColumn(
                label = "Prize Pool",
                value = "₹${formatMoney(tournament.prizePoolValue)}",
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier = Modifier
                    .height(32.dp)
                    .width(1.dp)
                    .background(DemoColors.BorderSoft),
            )
            StatColumn(
                label = "Per Kill",
                value = if (tournament.perKillValue > 0) "₹${formatMoney(tournament.perKillValue)}" else "Win Only",
                valueTint = DemoColors.TextSecondary,
                valueWeight = FontWeight.Bold,
                // lucide's Crosshair has no Material twin; GpsFixed is the same reticle
                leading = if (tournament.perKillValue > 0) Icons.Filled.GpsFixed else null,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp),
            )
            Box(
                modifier = Modifier
                    .height(32.dp)
                    .width(1.dp)
                    .background(DemoColors.BorderSoft),
            )
            StatColumn(
                label = "Entry Fee",
                value = "₹${formatMoney(tournament.entryFeeValue)}",
                modifier = Modifier.weight(1f),
                alignEnd = true,
            )
        }

        // ── Seats + CTA ─────────────────────────────────────────────────
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
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            Icons.Filled.People,
                            contentDescription = null,
                            tint = DemoColors.TextMuted,
                            modifier = Modifier.size(12.dp),
                        )
                        Text(
                            "${tournament.slotsBooked}/${tournament.totalSlots} Slots",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = DemoColors.TextSecondary,
                        )
                    }
                    Text(
                        "${tournament.remainingSlots} left",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextMuted,
                    )
                }

                // h-1.5 track + cyan fill
                Box(
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(DemoRadius.Pill))
                        .background(DemoColors.Track),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fillFraction)
                            .height(6.dp)
                            .clip(RoundedCornerShape(DemoRadius.Pill))
                            .background(DemoColors.Cyan),
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
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = if (joined) Color.White else DemoColors.OnGold,
                )
            }
        }
    }
}

/** `rounded-md border px-2 py-0.5 text-[10px] font-bold` with a 10dp icon. */
@Composable
private fun Chip(
    text: String,
    leading: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(DemoColors.ChipBg)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(leading, contentDescription = null, tint = iconTint, modifier = Modifier.size(10.dp))
        Text(
            text,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextSecondary,
            maxLines = 1,
        )
    }
}

@Composable
private fun StatColumn(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    valueTint: Color = DemoColors.TextPrimary,
    valueWeight: FontWeight = FontWeight.Black,
    leading: androidx.compose.ui.graphics.vector.ImageVector? = null,
    alignEnd: Boolean = false,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = if (alignEnd) Alignment.End else Alignment.Start,
    ) {
        Text(
            label.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextMuted,
            maxLines = 1,
        )
        Row(
            modifier = Modifier.padding(top = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (leading != null) {
                Icon(
                    leading,
                    contentDescription = null,
                    tint = DemoColors.TextMuted,
                    modifier = Modifier.size(12.dp),
                )
            }
            Text(
                value,
                fontSize = 12.sp,
                fontWeight = valueWeight,
                color = valueTint,
                maxLines = 1,
            )
        }
    }
}
