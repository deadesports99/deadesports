package com.tourney.player.ui.rewards

import android.content.Context
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ContentCopy
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tourney.core.model.DailyBonusState
import com.tourney.core.model.ReferralInfo
import com.tourney.core.model.RewardsSummary
import com.tourney.player.UiState
import com.tourney.core.ui.formatMoney
import com.tourney.player.ui.common.DemoBackground
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * ⭐ REWARDS TAB — daily bonus, tasks and referral on one page.
 *
 * Reading order is deliberate: the thing that expires today (daily bonus) sits
 * first and biggest, then the one-time wins (tasks), then the long game
 * (referral). Everything a returning player needs to know is above the fold;
 * the rules live in the footer instead of a paragraph under each card.
 */
@Composable
fun RewardsHubScreen(
    onOpenReferral: () -> Unit,
    onToast: (String) -> Unit,
    viewModel: RewardsViewModel = viewModel(),
) {
    val context = LocalContext.current
    var sheetOpen by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { if (viewModel.state is UiState.Idle) viewModel.refresh() }

    val state = viewModel.state
    val summary = (state as? UiState.Success)?.data

    LaunchedEffect(summary?.dailyBonus?.available) {
        val daily = summary?.dailyBonus ?: return@LaunchedEffect
        if (daily.available && !sheetAlreadyShownToday(context)) sheetOpen = true
    }

    LaunchedEffect(viewModel.toast) {
        val message = viewModel.toast ?: return@LaunchedEffect
        onToast(message)
        viewModel.clearToast()
    }

    DemoBackground {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 16.dp, top = 12.dp, bottom = 12.dp),
                ) {
                    Text(
                        "Rewards",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                    )
                    Text(
                        "Daily bonus · tasks · referral",
                        fontSize = DemoText.Tiny,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextMuted,
                    )
                }
                IconButton(onClick = { viewModel.refresh() }) {
                    Icon(
                        Icons.Filled.Refresh,
                        contentDescription = "Refresh rewards",
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

            when (state) {
                UiState.Idle, UiState.Loading -> Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Rewards load ho rahe hain…", fontSize = DemoText.Small, color = DemoColors.TextMuted)
                }

                is UiState.Error -> Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        state.message,
                        fontSize = DemoText.Tiny,
                        color = DemoColors.Danger,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(DemoRadius.Field))
                            .background(DemoColors.ChipBg)
                            .clickable { viewModel.refresh() }
                            .padding(horizontal = 14.dp, vertical = 7.dp),
                    ) {
                        Text("Try again", fontSize = DemoText.Tiny, fontWeight = FontWeight.Black, color = DemoColors.TextSecondary)
                    }
                }

                is UiState.Success -> {
                    val data = state.data
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        // 96dp bottom: last card must clear the 5-tab bottom bar.
                        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 96.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        data.dailyBonus?.let { daily ->
                            item {
                                DailyHeroCard(
                                    daily = daily,
                                    busy = viewModel.claimingDaily,
                                    onClaim = { viewModel.claimDailyBonus() },
                                )
                            }
                        }

                        if (data.tasks.isNotEmpty()) {
                            item {
                                SectionLabel(
                                    "TASKS",
                                    "${data.tasks.count { it.claimed }}/${data.tasks.size} done",
                                )
                            }
                            items(data.tasks) { task ->
                                TaskRow(
                                    task = task,
                                    busy = viewModel.claimingTaskId == task.id,
                                    onClaim = { viewModel.claimTask(task.id) },
                                )
                            }
                        }

                        data.referral?.let { referral ->
                            item {
                                SectionLabel("REFERRAL")
                                Spacer(Modifier.height(2.dp))
                            }
                            item { ReferralSummaryCard(referral = referral, onOpen = onOpenReferral) }
                        }

                        val error = viewModel.actionError
                        if (error != null) {
                            item {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(DemoRadius.Field))
                                        .background(DemoColors.Danger.copy(alpha = 0.12f))
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        error,
                                        modifier = Modifier.weight(1f),
                                        fontSize = DemoText.Tiny,
                                        fontWeight = FontWeight.Bold,
                                        color = DemoColors.Danger,
                                    )
                                    Text(
                                        "✕",
                                        fontSize = DemoText.Tiny,
                                        fontWeight = FontWeight.Black,
                                        color = DemoColors.Danger,
                                        modifier = Modifier
                                            .clickable { viewModel.clearError() }
                                            .padding(horizontal = 6.dp),
                                    )
                                }
                            }
                        }

                        item {
                            Text(
                                "Bonus paise sirf match join karne me lag sakte hain — withdraw nahi hote.",
                                fontSize = DemoText.Micro,
                                fontWeight = FontWeight.Bold,
                                color = DemoColors.TextFaint,
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 6.dp),
                            )
                        }
                    }
                }
            }
        }
    }

    if (sheetOpen) {
        DailyBonusSheet(
            daily = summary?.dailyBonus,
            busy = viewModel.claimingDaily,
            onDismiss = {
                markSheetShownToday(context)
                sheetOpen = false
            },
            onClaim = { viewModel.claimDailyBonus() },
        )
    }
}

/** The day guard is cosmetic (one nudge per day); the server owns the real one. */
private fun sheetAlreadyShownToday(context: Context): Boolean {
    val prefs = context.getSharedPreferences("rewards_ui", Context.MODE_PRIVATE)
    return prefs.getString("daily_sheet_day", null) == todayKey()
}

private fun markSheetShownToday(context: Context) {
    context.getSharedPreferences("rewards_ui", Context.MODE_PRIVATE)
        .edit()
        .putString("daily_sheet_day", todayKey())
        .apply()
}

private fun todayKey(): String = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())

/** Streak + today's amount + the gold claim button. */
@Composable
private fun DailyHeroCard(daily: DailyBonusState, busy: Boolean, onClaim: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(
                Brush.verticalGradient(
                    listOf(
                        DemoColors.Gold.copy(alpha = if (DemoColors.isDark) 0.14f else 0.16f),
                        DemoColors.Card,
                    ),
                ),
            )
            .border(1.dp, DemoColors.Gold.copy(alpha = 0.45f), RoundedCornerShape(DemoRadius.Card))
            .padding(horizontal = 14.dp, vertical = 12.dp),
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

        Row(
            modifier = Modifier.padding(top = 8.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            Text(
                "₹${formatMoney(daily.amount)}",
                fontSize = 30.sp,
                fontWeight = FontWeight.Black,
                color = if (daily.claimedToday) DemoColors.TextSecondary else DemoColors.Gold,
            )
            Spacer(Modifier.width(8.dp))
            Text(
                when {
                    daily.claimedToday -> "aaj ka bonus aa gaya"
                    daily.available -> "aaj ka bonus ready hai"
                    else -> "kal ka bonus"
                },
                fontSize = DemoText.Tiny,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
                modifier = Modifier.padding(bottom = 5.dp),
            )
        }

        Spacer(Modifier.height(10.dp))
        StreakDots(daily)
        Spacer(Modifier.height(12.dp))

        when {
            daily.available -> RewardCta(
                label = if (busy) "Claim ho raha hai…" else "Claim ₹${formatMoney(daily.amount)}",
                enabled = !busy,
                onClick = onClaim,
                modifier = Modifier.fillMaxWidth(),
            )

            daily.claimedToday -> Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.Success.copy(alpha = 0.14f))
                    .padding(vertical = 10.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Claimed ✓  ·  kal ka bonus ${daily.waitLabel}".trim(),
                    fontSize = DemoText.Small,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.Success,
                )
            }

            daily.blockedReason == "MIN_MATCHES" -> Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.Track)
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "${daily.minMatches} match khelne ke baad khulega (${daily.matchesPlayed}/${daily.minMatches})",
                    fontSize = DemoText.Tiny,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.TextMuted,
                )
            }
        }
    }
}

/** Code, invite stats and the way into the full referral screen. */
@Composable
private fun ReferralSummaryCard(referral: ReferralInfo, onOpen: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
            .clickable(onClick = onOpen)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Dost ko bulao",
                fontSize = DemoText.BodyStrong,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextPrimary,
            )
            Text(
                "₹${formatMoney(referral.rewardPerFriend)} tumhe · ₹${formatMoney(referral.friendReward)} usko",
                fontSize = DemoText.Tiny,
                fontWeight = FontWeight.Bold,
                color = DemoColors.Gold,
                modifier = Modifier.padding(top = 2.dp),
            )
            Row(
                modifier = Modifier.padding(top = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(DemoColors.ChipBg)
                        .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(6.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(
                        referral.code,
                        fontSize = DemoText.Small,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.Cyan,
                        fontFamily = FontFamily.Monospace,
                    )
                }
                Spacer(Modifier.width(6.dp))
                Icon(
                    Icons.Filled.ContentCopy,
                    contentDescription = "Copy referral code",
                    tint = DemoColors.TextMuted,
                    modifier = Modifier.size(13.dp),
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    "${referral.invited} invited · ₹${formatMoney(referral.earned)} earned",
                    fontSize = DemoText.Micro,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.TextMuted,
                )
            }
        }
        Icon(
            Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = DemoColors.TextMuted,
            modifier = Modifier.size(20.dp),
        )
    }
}
