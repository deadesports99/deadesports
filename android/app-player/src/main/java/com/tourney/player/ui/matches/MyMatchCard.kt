package com.tourney.player.ui.matches

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.MyMatch
import com.tourney.core.model.MyMatchActionKind
import com.tourney.core.model.MyMatchPhase
import com.tourney.core.model.MyMatchTone
import com.tourney.core.model.formatMyMatchNet
import com.tourney.core.model.myMatchAction
import com.tourney.core.model.myMatchPill
import com.tourney.core.model.myMatchTiming
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * One seat from the player's own history.
 *
 * Same visual language as the lobby's [MatchCard] — match number / map / mode
 * chips, IST stamp, money strip — but the bottom-right action is always a
 * **status**: "View Room ID" for a published room, "View Status" for a live or
 * finished match (opens [MatchStatusScreen]: placement, kills, prize per
 * player), "Joined — awaiting room" while nothing exists yet. There is no Join
 * button here; joining lives in the lobby.
 */
@Composable
fun MyMatchCard(
    match: MyMatch,
    onRoom: () -> Unit,
    onStatus: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val pill = myMatchPill(match)
    val action = myMatchAction(match)
    val result = match.result
    val phase = match.phaseEnum
    val isSettled = match.isSettled

    val (pillBg, pillText) = when (pill.tone) {
        MyMatchTone.CYAN -> DemoColors.Cyan.copy(alpha = 0.15f) to DemoColors.Cyan
        MyMatchTone.AMBER -> DemoColors.Warning.copy(alpha = 0.16f) to DemoColors.Warning
        MyMatchTone.ROSE -> DemoColors.Danger.copy(alpha = 0.16f) to DemoColors.Danger
        MyMatchTone.EMERALD -> DemoColors.Success.copy(alpha = 0.16f) to DemoColors.Success
        MyMatchTone.GOLD -> DemoColors.Gold.copy(alpha = 0.16f) to DemoColors.Gold
        MyMatchTone.SLATE -> DemoColors.ChipBg to DemoColors.TextSecondary
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card.copy(alpha = 0.85f))
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
            .padding(start = 14.dp, end = 14.dp, top = 10.dp, bottom = 12.dp),
    ) {
        // ── Match number + map + mode, status pill on the right ─────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            match.matchNumber?.let { number ->
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
            HistoryChip(match.mapLabel, Icons.Filled.Place, DemoColors.Cyan)
            HistoryChip(match.matchTypeLabel.uppercase(), Icons.Filled.SportsEsports, DemoColors.TextSecondary)
            Spacer(Modifier.weight(1f))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(DemoRadius.Pill))
                    .background(pillBg)
                    .padding(horizontal = 9.dp, vertical = 4.dp),
            ) {
                Text(
                    pill.label,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    color = pillText,
                )
            }
        }

        // ── Title + kickoff / seat / entry fee ──────────────────────────
        Text(
            match.displayName,
            fontSize = DemoText.Body,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp),
        )
        Text(
            "${formatMatchTime(match.matchTime)} · Slot ${match.slotNumber.toString().padStart(2, '0')} · Entry ₹${formatMoney(match.entryFee)}",
            fontSize = DemoText.Tiny,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 2.dp),
        )

        // ── Verified result strip (finished matches only) ───────────────
        if (isSettled) {
            Row(
                modifier = Modifier
                    .padding(top = 10.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.Strip)
                    .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (result != null) {
                    ResultStat(
                        label = if (result.rank == 1) "Booyah" else "Placement",
                        value = result.rank?.let { "Rank #$it" } ?: "Unranked",
                        tint = if (result.rank == 1) DemoColors.Gold else DemoColors.TextPrimary,
                    )
                    Spacer(Modifier.weight(1f))
                    ResultStat(
                        label = "Kills",
                        value = result.kills.toString(),
                        leading = Icons.Filled.GpsFixed,
                    )
                    Spacer(Modifier.width(16.dp))
                    ResultStat(
                        label = if (match.refunded && result.prizeWon <= 0.0) "Refund" else "Prize",
                        value = "₹${formatMoney(if (match.refunded && result.prizeWon <= 0.0) match.refundAmount else result.prizeWon)}",
                        tint = if (result.prizeWon > 0) DemoColors.Success else DemoColors.TextSecondary,
                        alignEnd = true,
                    )
                } else {
                    Text(
                        if (match.refunded) {
                            "Match cancelled — ₹${formatMoney(match.refundAmount)} refunded to your wallet."
                        } else {
                            "Result not published yet — the organiser is verifying this match."
                        },
                        fontSize = DemoText.Tiny,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextMuted,
                    )
                }
            }
        }

        // ── Ban / disqualification note (never hidden) ──────────────────
        val note = when {
            match.isBannedFromMatch -> match.banReason?.takeIf { it.isNotBlank() } ?: "Removed from this match by the organiser."
            result?.isDisqualified == true -> result.disqualifyReason?.takeIf { it.isNotBlank() } ?: "Disqualified by the organiser."
            else -> null
        }
        if (note != null) {
            Text(
                note,
                fontSize = DemoText.Tiny,
                fontWeight = FontWeight.Bold,
                color = DemoColors.Danger,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        // ── Money outcome + status action (the replacement for Join) ────
        Row(
            modifier = Modifier
                .padding(top = 10.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val timing = if (isSettled) "" else myMatchTiming(match.matchTime, System.currentTimeMillis(), phase)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    when {
                        isSettled -> "NET RESULT"
                        phase == MyMatchPhase.LIVE -> "STATUS"
                        timing.isNotEmpty() -> "STARTS"
                        else -> "YOUR SEAT"
                    },
                    fontSize = DemoText.Micro,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.TextMuted,
                )
                Text(
                    when {
                        isSettled -> match.net?.let { formatMyMatchNet(it) } ?: "—"
                        timing.isNotEmpty() -> timing
                        else -> "Slot ${match.slotNumber.toString().padStart(2, '0')}"
                    },
                    fontSize = DemoText.Small,
                    fontWeight = FontWeight.Black,
                    color = when {
                        !isSettled -> DemoColors.TextPrimary
                        match.net == null -> DemoColors.TextSecondary
                        match.net!! > 0 -> DemoColors.Success
                        match.net!! < 0 -> DemoColors.Danger
                        else -> DemoColors.TextSecondary
                    },
                )
            }

            // Two live actions only: open the code (gold) or open the board
            // (cyan outline, so it never looks like a money/join action).
            val canOpenRoom = action.kind == MyMatchActionKind.ROOM
            val canOpenStatus = action.kind == MyMatchActionKind.STATUS
            val enabled = canOpenRoom || canOpenStatus
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(
                        when {
                            canOpenRoom -> DemoColors.Gold
                            canOpenStatus -> DemoColors.Cyan.copy(alpha = 0.16f)
                            else -> DemoColors.Track
                        },
                    )
                    .border(
                        width = if (canOpenStatus) 1.dp else 0.dp,
                        color = if (canOpenStatus) DemoColors.Cyan.copy(alpha = 0.5f) else Color.Transparent,
                        shape = RoundedCornerShape(8.dp),
                    )
                    .clickable(enabled = enabled) {
                        when (action.kind) {
                            MyMatchActionKind.ROOM -> onRoom()
                            MyMatchActionKind.STATUS -> onStatus()
                            else -> Unit
                        }
                    }
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Text(
                    action.label,
                    fontSize = DemoText.Small,
                    fontWeight = FontWeight.Black,
                    color = when {
                        canOpenRoom -> DemoColors.OnGold
                        canOpenStatus -> DemoColors.Cyan
                        else -> DemoColors.TextMuted
                    },
                )
            }
        }

        // Live matches get one extra line so the player knows the room is coming.
        if (phase == MyMatchPhase.LIVE && !match.canOpenRoom) {
            Text(
                "Live now — the Room ID shows up here as soon as the organiser publishes it.",
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        // Kickoff passed without the match going LIVE — the organiser has not
        // pressed "Go live" yet. The pill already says STARTING SOON and the
        // STARTS column reads "starting shortly", so no extra paragraph here.
    }
}

@Composable
private fun HistoryChip(
    text: String,
    leading: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
) {
    Row(
        modifier = Modifier
            .height(24.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(DemoColors.ChipBg)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(6.dp))
            .padding(horizontal = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Icon(leading, contentDescription = null, tint = iconTint, modifier = Modifier.size(10.dp))
        Text(
            text,
            fontSize = DemoText.Tiny,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextSecondary,
            maxLines = 1,
        )
    }
}

@Composable
private fun ResultStat(
    label: String,
    value: String,
    tint: Color = DemoColors.TextPrimary,
    leading: androidx.compose.ui.graphics.vector.ImageVector? = null,
    alignEnd: Boolean = false,
) {
    Column(horizontalAlignment = if (alignEnd) Alignment.End else Alignment.Start) {
        Text(label.uppercase(), fontSize = DemoText.Micro, fontWeight = FontWeight.Bold, color = DemoColors.TextMuted)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            if (leading != null) {
                Icon(leading, contentDescription = null, tint = DemoColors.TextMuted, modifier = Modifier.size(10.dp))
            }
            if (label.lowercase() == "prize" || label.lowercase() == "refund") {
                Icon(Icons.Filled.Star, contentDescription = null, tint = tint, modifier = Modifier.size(10.dp))
            }
            Text(value, fontSize = DemoText.Small, fontWeight = FontWeight.Black, color = tint, maxLines = 1)
        }
    }
}

/** Kept next to the card so the settlement rule is testable without Compose. */
fun myMatchShowsResult(match: MyMatch): Boolean = match.isSettled && match.result != null
