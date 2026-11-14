package com.tourney.player.ui.matches

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentStatus
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney
import com.tourney.core.util.TimeAuthority
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import kotlinx.coroutines.delay

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
    /**
     * Seated player AND the organiser already published the custom room.
     * The CTA then becomes "Room ID Ready" instead of a plain "Joined ✓", so the
     * player knows the code has arrived and that tapping opens it.
     */
    roomReady: Boolean = false,
) {
    val fillFraction = if (tournament.totalSlots <= 0) 0f
    else (tournament.slotsBooked.toFloat() / tournament.totalSlots).coerceIn(0f, 1f)

    val isFull = tournament.remainingSlots <= 0
    val isLive = tournament.status == TournamentStatus.LIVE
    // A full or kicked-off match cannot be joined, so neither the card nor the
    // CTA reacts to taps — except for a seated player, who still opens the room.
    val actionEnabled = joined || (!isFull && !isLive)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card.copy(alpha = 0.85f))
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
            .clickable(enabled = actionEnabled, onClick = onOpen)
            // Slightly tighter at the top so the chips + date sit a touch higher.
            .padding(start = 14.dp, end = 14.dp, top = 10.dp, bottom = 14.dp),
    ) {
        // ── Top: match number + map + mode chips, live countdown on the right ──
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            // The number is the match identity — admin/staff refer to "match 50".
            tournament.matchNumber?.let { number ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(DemoColors.Cyan.copy(alpha = 0.14f))
                        .padding(horizontal = 7.dp, vertical = 3.dp),
                ) {
                    Text(
                        number.toString(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.Cyan,
                    )
                }
            }
            Chip(text = tournament.mapLabel, leading = Icons.Filled.Place, iconTint = DemoColors.Cyan)
            Chip(
                text = tournament.matchTypeLabel.uppercase(),
                leading = Icons.Filled.SportsEsports,
                iconTint = DemoColors.TextSecondary,
            )
            Box(Modifier.weight(1f))
            MatchCountdown(
                matchTimeIso = tournament.matchTime,
                isLive = isLive,
            )
        }

        // Title line intentionally omitted: the top chips already carry the
        // match number + map + mode ("7 | Bermuda • Squad" was a duplicate).

        // ── Kickoff date + time, directly under the chips row ───────────
        Text(
            formatMatchTime(tournament.matchTime),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextMuted,
            maxLines = 1,
            modifier = Modifier.padding(top = 5.dp),
        )

        // ── Prize pool / per kill / entry fee strip ─────────────────────
        // Same as the demo's `grid grid-cols-3` with `border-x` on the middle
        // cell: three equal columns, the rules run the full height of the strip
        // and sit the same distance from the text on both of their sides.
        Row(
            modifier = Modifier
                .padding(top = 10.dp)
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
                .clip(RoundedCornerShape(DemoRadius.Field))
                .background(DemoColors.Strip)
                .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            // SpaceBetween gives all four gaps around the two rules the same
            // width, so each rule sits equally far from the text on both sides.
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            StatColumn(
                label = "Prize Pool",
                value = "₹${formatMoney(tournament.prizePoolValue)}",
            )
            StatRule()
            StatColumn(
                label = "Per Kill",
                value = if (tournament.perKillValue > 0) "₹${formatMoney(tournament.perKillValue)}" else "Win Only",
                valueTint = DemoColors.TextSecondary,
                valueWeight = FontWeight.Bold,
                // lucide's Crosshair has no Material twin; GpsFixed is the same reticle
                leading = if (tournament.perKillValue > 0) Icons.Filled.GpsFixed else null,
            )
            StatRule()
            StatColumn(
                label = "Entry Fee",
                value = "₹${formatMoney(tournament.entryFeeValue)}",
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
                    val remaining = tournament.remainingSlots
                    Text(
                        // Plain English instead of "0 left" — the player should
                        // read why the join button is dead.
                        if (remaining <= 0) "Slot Full" else "$remaining left",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (remaining <= 0) DemoColors.Danger else DemoColors.TextMuted,
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

            // CTA colours are the truth: gold = joinable, green = seated,
            // grey = dead (full / live / already watching).
            val ctaBackground = when {
                joined -> DemoColors.Success
                isLive || isFull -> DemoColors.Track
                else -> DemoColors.Gold
            }
            val ctaTextColor = when {
                joined -> Color.White
                isLive || isFull -> DemoColors.TextMuted
                else -> DemoColors.OnGold
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(ctaBackground)
                    .border(
                        // A published room gets a gold ring so it reads as "open me".
                        width = if (joined && roomReady) 1.dp else 0.dp,
                        color = if (joined && roomReady) DemoColors.Gold else Color.Transparent,
                        shape = RoundedCornerShape(8.dp),
                    )
                    .clickable(enabled = actionEnabled, onClick = onOpen)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Text(
                    when {
                        // Seated + room published → the player must see that the
                        // custom room code is available now.
                        joined && roomReady -> "Room ID Ready"
                        joined -> "Joined ✓"
                        isLive -> "Watch live"
                        isFull -> "Slot Full"
                        else -> "Join • ₹${formatMoney(tournament.entryFeeValue)}"
                    },
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = ctaTextColor,
                )
            }
        }
    }
}

/** Minutes before kickoff at which the countdown switches to the urgent (red) state. */
private const val LIVE_SOON_SECONDS = 15L * 60L

/**
 * Real countdown to kickoff — ticks every second off the server-synced clock
 * ([TimeAuthority]), so a phone with a wrong clock still shows the right numbers.
 *
 *  > 1 day   → "2d 04h 10m"
 *  > 1 hour  → "02:15:22"
 *  < 1 hour  → "14:59"
 *  last 15 min / live / started → red + pulsing dot
 */
@Composable
private fun MatchCountdown(matchTimeIso: String, isLive: Boolean) {
    var secondsLeft by remember(matchTimeIso) { mutableStateOf(remainingSeconds(matchTimeIso)) }

    LaunchedEffect(matchTimeIso) {
        while (true) {
            secondsLeft = remainingSeconds(matchTimeIso)
            delay(1_000L)
        }
    }

    val started = secondsLeft <= 0L
    val urgent = !isLive && !started && secondsLeft <= LIVE_SOON_SECONDS
    val accent = when {
        isLive || started || urgent -> DemoColors.Danger
        else -> DemoColors.Gold
    }

    Column(horizontalAlignment = Alignment.End) {
        Text(
            when {
                isLive -> "MATCH"
                started -> "KICKOFF"
                else -> "MATCH STARTS IN"
            },
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextMuted,
            letterSpacing = 1.sp,
            maxLines = 1,
        )
        Row(
            modifier = Modifier.padding(top = 1.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            // Pulsing dot only when it matters (live, or inside the last 15 min).
            if (isLive || urgent) {
                val pulse = rememberInfiniteTransition(label = "kickoffPulse")
                val dotAlpha by pulse.animateFloat(
                    initialValue = 1f,
                    targetValue = 0.2f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(900, easing = LinearEasing),
                        repeatMode = RepeatMode.Reverse,
                    ),
                    label = "kickoffDot",
                )
                Box(
                    modifier = Modifier
                        .size(5.dp)
                        .alpha(dotAlpha)
                        .clip(RoundedCornerShape(50))
                        .background(accent),
                )
            }
            Text(
                when {
                    isLive -> "LIVE NOW"
                    started -> "STARTING NOW"
                    else -> formatCountdown(secondsLeft)
                },
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.5.sp,
                color = accent,
                maxLines = 1,
            )
        }
    }
}

/** Seconds left until [iso] kickoff, floored at 0 (a past match reads as started). */
private fun remainingSeconds(iso: String): Long = runCatching {
    val kickoff = java.time.Instant.parse(iso).toEpochMilli()
    ((kickoff - TimeAuthority.currentTimeMillis()) / 1_000L).coerceAtLeast(0L)
}.getOrDefault(0L)

/** Compact, always-monospace countdown text. */
private fun formatCountdown(totalSeconds: Long): String {
    val days = totalSeconds / 86_400L
    val hours = (totalSeconds % 86_400L) / 3_600L
    val minutes = (totalSeconds % 3_600L) / 60L
    val seconds = totalSeconds % 60L
    return when {
        days > 0L -> String.format(java.util.Locale.US, "%dd %02dh %02dm", days, hours, minutes)
        hours > 0L -> String.format(java.util.Locale.US, "%02d:%02d:%02d", hours, minutes, seconds)
        else -> String.format(java.util.Locale.US, "%02d:%02d", minutes, seconds)
    }
}

/** Match row / info chips (map, mode) — still used by other cards. */
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
            softWrap = false,
            overflow = TextOverflow.Ellipsis,
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
                softWrap = false,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/**
 * The rule between two stat columns: 1dp wide, centred, and inset from the
 * strip's top and bottom edges by the panel's own vertical padding — the same
 * "gap above and below" the demo has.
 */
@Composable
private fun StatRule() {
    Box(
        modifier = Modifier
            .fillMaxHeight()
            .width(1.dp)
            .background(DemoColors.BorderSoft),
    )
}
