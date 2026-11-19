package com.tourney.player.ui.rewards

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.DailyBonusState
import com.tourney.core.model.RewardTask
import com.tourney.core.ui.formatMoney
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * Small, reused pieces of the Rewards tab.
 *
 * Palette discipline (same as every other ported screen): gold = claimable
 * reward, green = already credited, cyan = information, muted grey = not yet.
 */

/** The 7-day streak ladder: filled = claimed, ring = today, grey = locked. */
@Composable
fun StreakDots(state: DailyBonusState) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        val claimedThrough = if (state.claimedToday) state.streakDay else state.streakDay - 1
        for (day in 1..state.streakTarget) {
            val claimed = day <= claimedThrough
            val today = day == state.streakDay && !state.claimedToday
            val amount = state.ladder.getOrNull(day - 1) ?: 0.0

            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(26.dp)
                        .clip(RoundedCornerShape(7.dp))
                        .background(
                            when {
                                claimed -> DemoColors.Success.copy(alpha = 0.20f)
                                today -> DemoColors.Gold.copy(alpha = 0.18f)
                                else -> DemoColors.ChipBg
                            },
                        )
                        .border(
                            width = if (today) 1.dp else 0.dp,
                            color = if (today) DemoColors.Gold else Color.Transparent,
                            shape = RoundedCornerShape(7.dp),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    if (claimed) {
                        Icon(
                            Icons.Filled.Check,
                            contentDescription = "Day $day claimed",
                            tint = DemoColors.Success,
                            modifier = Modifier.size(12.dp),
                        )
                    } else {
                        Text(
                            formatMoney(amount),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            color = if (today) DemoColors.Gold else DemoColors.TextMuted,
                            maxLines = 1,
                        )
                    }
                }
                Text(
                    "D$day",
                    fontSize = 8.sp,
                    fontWeight = if (today) FontWeight.Black else FontWeight.Bold,
                    color = if (today) DemoColors.Gold else DemoColors.TextFaint,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

/** Gold gradient CTA used by both the hub and the sheet. */
@Composable
fun RewardCta(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = DemoColors.Gold,
    textColor: Color = DemoColors.OnGold,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(
                if (enabled) {
                    Brush.horizontalGradient(listOf(tint, tint.copy(alpha = 0.86f)))
                } else {
                    Brush.horizontalGradient(listOf(DemoColors.Track, DemoColors.Track))
                },
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 11.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontSize = DemoText.Small,
            fontWeight = FontWeight.Black,
            color = if (enabled) textColor else DemoColors.TextMuted,
            maxLines = 1,
        )
    }
}

/** Small neutral chip (code, streak label, status). */
@Composable
fun RewardChip(
    text: String,
    tint: Color = DemoColors.TextSecondary,
    background: Color = DemoColors.ChipBg,
    border: Color = DemoColors.BorderSoft,
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(DemoRadius.Pill))
            .background(background)
            .border(1.dp, border, RoundedCornerShape(DemoRadius.Pill))
            .padding(horizontal = 9.dp, vertical = 3.dp),
    ) {
        Text(text, fontSize = 9.sp, fontWeight = FontWeight.Black, color = tint, maxLines = 1)
    }
}

/** "TASKS · 2/5 done" style section header. */
@Composable
fun SectionLabel(text: String, trailing: String? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text,
            fontSize = DemoText.Small,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextSecondary,
            letterSpacing = 0.4.sp,
        )
        if (trailing != null) {
            Spacer(Modifier.weight(1f))
            Text(
                trailing,
                fontSize = DemoText.Tiny,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
            )
        }
    }
}

/** One task: title, progress bar, reward and its claim state. */
@Composable
fun TaskRow(
    task: RewardTask,
    busy: Boolean,
    onClaim: () -> Unit,
) {
    val done = task.claimed
    val claimable = task.claimable && !busy

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Card.copy(alpha = if (done) 0.55f else 0.9f))
            .border(
                width = if (task.claimable && !done) 1.dp else 1.dp,
                color = if (task.claimable && !done) DemoColors.Cyan.copy(alpha = 0.45f) else DemoColors.BorderFaint,
                shape = RoundedCornerShape(DemoRadius.Field),
            )
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(CircleShape)
                .background(
                    when {
                        done -> DemoColors.Success.copy(alpha = 0.18f)
                        task.claimable -> DemoColors.Cyan.copy(alpha = 0.16f)
                        else -> DemoColors.ChipBg
                    },
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (done) {
                Icon(
                    Icons.Filled.Check,
                    contentDescription = null,
                    tint = DemoColors.Success,
                    modifier = Modifier.size(14.dp),
                )
            } else {
                Text(
                    "${task.progress}/${task.target}",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    color = if (task.claimable) DemoColors.Cyan else DemoColors.TextMuted,
                )
            }
        }

        Spacer(Modifier.width(10.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                task.title,
                fontSize = DemoText.Small,
                fontWeight = FontWeight.Black,
                color = if (done) DemoColors.TextMuted else DemoColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (!done) {
                Box(
                    modifier = Modifier
                        .padding(top = 5.dp)
                        .fillMaxWidth()
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(DemoColors.Track),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(task.fraction)
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(if (task.claimable) DemoColors.Gold else DemoColors.Cyan),
                    )
                }
            }
        }

        Spacer(Modifier.width(10.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "₹${formatMoney(task.reward)}",
                fontSize = DemoText.Small,
                fontWeight = FontWeight.Black,
                color = if (done) DemoColors.TextFaint else DemoColors.TextPrimary,
            )
            Spacer(Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(7.dp))
                    .background(
                        when {
                            done -> DemoColors.Track
                            task.claimable -> DemoColors.Gold
                            else -> DemoColors.Track
                        },
                    )
                    .clickable(enabled = claimable, onClick = onClaim)
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            ) {
                Text(
                    when {
                        done -> "✓"
                        busy -> "..."
                        task.claimable -> "Claim"
                        else -> "Locked"
                    },
                    fontSize = DemoText.Tiny,
                    fontWeight = FontWeight.Black,
                    color = when {
                        done -> DemoColors.TextMuted
                        task.claimable -> DemoColors.OnGold
                        else -> DemoColors.TextMuted
                    },
                )
            }
        }
    }
}
