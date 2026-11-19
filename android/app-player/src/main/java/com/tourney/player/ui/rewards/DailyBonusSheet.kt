package com.tourney.player.ui.rewards

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.DailyBonusState
import com.tourney.core.ui.formatMoney
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * The once-a-day nudge: streak, today's amount, one gold button.
 *
 * Shown at most once per day (a local day guard), and only when the server says
 * the bonus is actually claimable — a sheet that opens on an already-claimed day
 * is worse than no sheet at all.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DailyBonusSheet(
    daily: DailyBonusState?,
    busy: Boolean,
    onDismiss: () -> Unit,
    onClaim: () -> Unit,
) {
    if (daily == null || !daily.available) return
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DemoColors.Card,
        contentColor = DemoColors.TextPrimary,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 18.dp, end = 18.dp, bottom = 26.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "DAILY BONUS",
                    fontSize = DemoText.Micro,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.Gold,
                    letterSpacing = 0.8.sp,
                )
                Spacer(Modifier.weight(1f))
                RewardChip(
                    "DAY ${daily.streakDay}/${daily.streakTarget}",
                    tint = DemoColors.Gold,
                    background = DemoColors.Gold.copy(alpha = 0.14f),
                    border = DemoColors.Gold.copy(alpha = 0.35f),
                )
            }

            Text(
                "₹${formatMoney(daily.amount)}",
                fontSize = 40.sp,
                fontWeight = FontWeight.Black,
                color = DemoColors.Gold,
                modifier = Modifier.padding(top = 10.dp),
            )
            Text(
                "Aaj ka bonus ready hai — ${daily.streakDay}/${daily.streakTarget} din ka streak.",
                fontSize = DemoText.Small,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextSecondary,
                modifier = Modifier.padding(top = 2.dp),
            )

            Spacer(Modifier.height(16.dp))
            StreakDots(daily)
            Spacer(Modifier.height(18.dp))

            RewardCta(
                label = if (busy) "Claim ho raha hai…" else "Claim ₹${formatMoney(daily.amount)}",
                enabled = !busy,
                onClick = onClaim,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(6.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .clickable(onClick = onDismiss)
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "Abhi nahi",
                    fontSize = DemoText.Small,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.TextMuted,
                )
            }
            Text(
                "Bonus paise match join karne me lagte hain — withdraw nahi hote.",
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextFaint,
            )
        }
    }
}
