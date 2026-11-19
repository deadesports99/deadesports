package com.tourney.player.ui.rewards

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Share
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.ReferralInfo
import com.tourney.core.model.ReferralInvitee
import com.tourney.player.UiState
import com.tourney.core.ui.formatMoney
import com.tourney.player.ui.common.DemoBackground
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText
import androidx.lifecycle.viewmodel.compose.viewModel

/**
 * 🤝 REFERRAL DETAILS — code, rules, invitees, and the "mera code apply karo"
 * field for the players who were invited by someone else.
 *
 * Privacy: an invited friend's IGN is only shown after they qualify (the server
 * returns `ign = null` while the invitation is still pending).
 */
@Composable
fun ReferralScreen(
    onBack: () -> Unit,
    onToast: (String) -> Unit,
    viewModel: RewardsViewModel = viewModel(),
) {
    val context = LocalContext.current
    var applyCode by remember { mutableStateOf("") }

    LaunchedEffect(Unit) { viewModel.refreshReferral() }
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
                IconButton(onClick = onBack) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = DemoColors.TextPrimary,
                    )
                }
                Text(
                    "Referral",
                    modifier = Modifier.weight(1f),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.TextPrimary,
                )
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(DemoColors.BorderFaint),
            )

            when (val state = viewModel.referralUi) {
                UiState.Idle, UiState.Loading -> Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Referral load ho raha hai…", fontSize = DemoText.Small, color = DemoColors.TextMuted)
                }

                is UiState.Error -> Box(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(state.message, fontSize = DemoText.Tiny, color = DemoColors.Danger, textAlign = TextAlign.Center)
                }

                is UiState.Success -> {
                    val info = state.data
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 96.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        item {
                            CodeCard(
                                code = info.code,
                                onCopy = {
                                    copyToClipboard(context, info.code)
                                    onToast("Code copy ho gaya")
                                },
                                onShare = { shareCode(context, info.shareText) },
                            )
                        }

                        item { StatsStrip(info) }

                        item {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(DemoRadius.Field))
                                    .background(DemoColors.Card)
                                    .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                            ) {
                                Text(
                                    "KAISE KAAM KARTA HAI",
                                    fontSize = DemoText.Micro,
                                    fontWeight = FontWeight.Black,
                                    color = DemoColors.TextMuted,
                                    letterSpacing = 0.6.sp,
                                )
                                RuleLine("1", "Apna code dost ko bhejo — wo signup ke baad apply karega.")
                                RuleLine("2", "Dost ${info.minMatches} paid match khelega, phir reward release hoga.")
                                RuleLine(
                                    "3",
                                    "₹${formatMoney(info.rewardPerFriend)} tumhe, ₹${formatMoney(info.friendReward)} dost ko — wallet me.",
                                )
                            }
                        }

                        if (!info.applied) {
                            item {
                                ApplyCodeCard(
                                    value = applyCode,
                                    error = viewModel.actionError,
                                    onChange = { applyCode = it.uppercase().take(10) },
                                    onApply = {
                                        viewModel.applyReferralCode(applyCode) { applied ->
                                            if (applied != null) {
                                                applyCode = ""
                                                viewModel.refreshReferral()
                                                onToast("Referral code apply ho gaya")
                                            }
                                        }
                                    },
                                )
                            }
                        }

                        if (info.invitees.isNotEmpty()) {
                            item { SectionLabel("INVITED FRIENDS", "${info.invitees.size}") }
                            items(info.invitees) { invitee ->
                                InviteeRow(invitee)
                            }
                        }

                        item {
                            Text(
                                "Rewards wallet me credit hote hain — withdraw nahi ho sakte.",
                                fontSize = DemoText.Micro,
                                fontWeight = FontWeight.Bold,
                                color = DemoColors.TextFaint,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CodeCard(code: String, onCopy: () -> Unit, onShare: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Gold.copy(alpha = if (DemoColors.isDark) 0.13f else 0.16f))
            .border(1.dp, DemoColors.Gold.copy(alpha = 0.45f), RoundedCornerShape(DemoRadius.Card))
            .padding(horizontal = 14.dp, vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "YOUR REFERRAL CODE",
            fontSize = DemoText.Micro,
            fontWeight = FontWeight.Black,
            color = DemoColors.Gold,
            letterSpacing = 0.8.sp,
        )
        Text(
            code,
            fontSize = 30.sp,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextPrimary,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(top = 6.dp),
        )
        Row(
            modifier = Modifier.padding(top = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(DemoColors.Gold)
                    .clickable(onClick = onCopy)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Filled.ContentCopy,
                    contentDescription = null,
                    tint = DemoColors.OnGold,
                    modifier = Modifier.size(13.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text("Copy", fontSize = DemoText.Small, fontWeight = FontWeight.Black, color = DemoColors.OnGold)
            }
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(DemoColors.ChipBg)
                    .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(8.dp))
                    .clickable(onClick = onShare)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Filled.Share,
                    contentDescription = null,
                    tint = DemoColors.TextSecondary,
                    modifier = Modifier.size(13.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text("Share", fontSize = DemoText.Small, fontWeight = FontWeight.Black, color = DemoColors.TextSecondary)
            }
        }
    }
}

@Composable
private fun StatsStrip(info: ReferralInfo) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        listOf(
            "INVITED" to info.invited.toString(),
            "QUALIFIED" to info.qualified.toString(),
            "EARNED" to "₹${formatMoney(info.earned)}",
        ).forEach { (label, value) ->
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.Card.copy(alpha = 0.85f))
                    .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                    .padding(vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(value, fontSize = DemoText.Body, fontWeight = FontWeight.Black, color = DemoColors.TextPrimary, maxLines = 1)
                Text(label, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = DemoColors.TextMuted, maxLines = 1)
            }
        }
    }
}

@Composable
private fun RuleLine(index: String, text: String) {
    Row(modifier = Modifier.padding(top = 7.dp), verticalAlignment = Alignment.Top) {
        Box(
            modifier = Modifier
                .size(16.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(DemoColors.ChipBg),
            contentAlignment = Alignment.Center,
        ) {
            Text(index, fontSize = 9.sp, fontWeight = FontWeight.Black, color = DemoColors.Gold)
        }
        Spacer(Modifier.width(8.dp))
        Text(
            text,
            fontSize = DemoText.Tiny,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextSecondary,
            lineHeight = 13.sp,
        )
    }
}

@Composable
private fun ApplyCodeCard(
    value: String,
    error: String?,
    onChange: (String) -> Unit,
    onApply: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Card))
            .background(DemoColors.Card)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
            .padding(horizontal = 12.dp, vertical = 12.dp),
    ) {
        Text(
            "INVITE CODE HAI?",
            fontSize = DemoText.Micro,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextMuted,
            letterSpacing = 0.6.sp,
        )
        Row(
            modifier = Modifier.padding(top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(DemoColors.Field)
                    .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 9.dp),
            ) {
                if (value.isEmpty()) {
                    Text("DOST KA CODE", fontSize = DemoText.Tiny, fontWeight = FontWeight.Bold, color = DemoColors.TextFaint)
                }
                BasicTextField(
                    value = value,
                    onValueChange = onChange,
                    singleLine = true,
                    textStyle = TextStyle(
                        fontSize = DemoText.Body,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                        fontFamily = FontFamily.Monospace,
                    ),
                    cursorBrush = SolidColor(DemoColors.Gold),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Spacer(Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (value.isNotBlank()) DemoColors.Gold else DemoColors.Track)
                    .clickable(enabled = value.isNotBlank(), onClick = onApply)
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            ) {
                Text(
                    "Apply",
                    fontSize = DemoText.Small,
                    fontWeight = FontWeight.Black,
                    color = if (value.isNotBlank()) DemoColors.OnGold else DemoColors.TextMuted,
                )
            }
        }
        // Error lives under the field it belongs to — an error three cards down
        // is an error nobody reads.
        if (error != null) {
            Text(
                error,
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Bold,
                color = DemoColors.Danger,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}

@Composable
private fun InviteeRow(invitee: ReferralInvitee) {
    val (label, tint) = when (invitee.status) {
        "PAID" -> "PAID" to DemoColors.Success
        "QUALIFIED" -> "QUALIFIED" to DemoColors.Cyan
        "VOID" -> "VOID" to DemoColors.TextMuted
        else -> "PENDING" to DemoColors.Warning
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Card.copy(alpha = 0.85f))
            .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            invitee.ign ?: "Friend",
            modifier = Modifier.weight(1f),
            fontSize = DemoText.Small,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextPrimary,
            maxLines = 1,
        )
        RewardChip(label, tint = tint, background = tint.copy(alpha = 0.14f), border = tint.copy(alpha = 0.35f))
    }
}

private fun copyToClipboard(context: Context, text: String) {
    val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    manager?.setPrimaryClip(ClipData.newPlainText("Referral code", text))
}

private fun shareCode(context: Context, text: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(intent, "Share referral code"))
}
