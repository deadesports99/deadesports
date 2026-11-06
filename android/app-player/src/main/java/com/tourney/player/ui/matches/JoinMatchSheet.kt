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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.Tournament
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney
import com.tourney.player.ui.common.DemoMessage
import com.tourney.player.ui.common.DemoTextField
import com.tourney.player.ui.common.GoldButton
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * Quick-join bottom sheet from the demo, plus the two fields the owner asked for:
 * **In-Game Name** and **Free Fire UID** — the organiser needs them to seat the
 * player in the custom room, and the API stores them as the player's default.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JoinMatchSheet(
    tournament: Tournament,
    balance: Double,
    joined: Boolean,
    joining: Boolean,
    errorText: String?,
    entryClosed: Boolean,
    defaultIgn: String,
    defaultUid: String,
    onDismiss: () -> Unit,
    onJoin: (ign: String, uid: String) -> Unit,
    onTopUp: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var ign by remember(tournament.id) { mutableStateOf(defaultIgn) }
    var uid by remember(tournament.id) { mutableStateOf(defaultUid) }

    // Prefill once the profile arrives after the sheet is already open.
    LaunchedEffect(defaultIgn, defaultUid) {
        if (ign.isBlank()) ign = defaultIgn
        if (uid.isBlank()) uid = defaultUid
    }

    val ignOk = ign.trim().length in 2..30
    val uidOk = uid.trim().length in 6..12 && uid.all { it.isDigit() }
    val canAfford = balance >= tournament.entryFeeValue
    val identityOk = ignOk && uidOk

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DemoColors.Card,
        contentColor = DemoColors.TextPrimary,
        shape = RoundedCornerShape(topStart = DemoRadius.Sheet, topEnd = DemoRadius.Sheet),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 24.dp),
        ) {
            // Grab bar.
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(bottom = 12.dp)
                    .width(48.dp)
                    .height(5.dp)
                    .clip(RoundedCornerShape(DemoRadius.Pill))
                    .background(DemoColors.TextMuted.copy(alpha = 0.35f)),
            )

            Row(verticalAlignment = Alignment.Top) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "QUICK JOIN • ${tournament.matchTypeLabel.uppercase()}",
                        fontSize = DemoText.Tiny,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextMuted,
                    )
                    Text(
                        tournament.displayName,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(
                        "Review your entry before securing a slot.",
                        fontSize = DemoText.Body,
                        color = DemoColors.TextMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Filled.Close, contentDescription = "Close quick join", tint = DemoColors.TextMuted)
                }
            }

            // Map & mode / match time.
            Row(
                modifier = Modifier.padding(top = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                InfoBox(
                    label = "Map & Mode",
                    value = tournament.mapLabel,
                    sub = tournament.matchTypeLabel,
                    modifier = Modifier.weight(1f),
                )
                InfoBox(
                    label = "Match Time",
                    value = formatMatchTime(tournament.matchTime),
                    sub = "Room ID after organiser publishes",
                    modifier = Modifier.weight(1f),
                )
            }

            // Prize pool / per kill.
            Row(
                modifier = Modifier
                    .padding(top = 8.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.Field)
                    .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                    .padding(12.dp),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("PRIZE POOL", fontSize = DemoText.Tiny, fontWeight = FontWeight.Bold, color = DemoColors.TextMuted)
                    Text(
                        "₹${formatMoney(tournament.prizePoolValue)}",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                    )
                }
                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                    Text("PER KILL", fontSize = DemoText.Tiny, fontWeight = FontWeight.Bold, color = DemoColors.TextMuted)
                    Text(
                        if (tournament.perKillValue > 0) "₹${formatMoney(tournament.perKillValue)}" else "Win Only",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                    )
                }
            }

            // Free Fire identity — who gets seated in the custom room.
            Column(
                modifier = Modifier
                    .padding(top = 10.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.Field)
                    .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                    .padding(12.dp),
            ) {
                Text(
                    "YOUR FREE FIRE DETAILS",
                    fontSize = DemoText.Tiny,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.TextMuted,
                )
                Row(
                    modifier = Modifier.padding(top = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.Person, contentDescription = null, tint = DemoColors.TextMuted, modifier = Modifier.size(12.dp))
                    Text(
                        " In-Game Name (IGN)",
                        fontSize = DemoText.Small,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextSecondary,
                    )
                }
                DemoTextField(
                    value = ign,
                    onValueChange = { ign = it },
                    placeholder = "e.g. SpartanOP",
                    enabled = !joined && !joining,
                    maxLength = 30,
                    isError = ign.isNotEmpty() && !ignOk,
                    modifier = Modifier.padding(top = 6.dp),
                )
                Row(
                    modifier = Modifier.padding(top = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.SportsEsports, contentDescription = null, tint = DemoColors.TextMuted, modifier = Modifier.size(12.dp))
                    Text(
                        " Free Fire UID",
                        fontSize = DemoText.Small,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextSecondary,
                    )
                }
                DemoTextField(
                    value = uid,
                    onValueChange = { uid = it },
                    placeholder = "6-12 digit UID",
                    enabled = !joined && !joining,
                    digitsOnly = true,
                    maxLength = 12,
                    isError = uid.isNotEmpty() && !uidOk,
                    modifier = Modifier.padding(top = 6.dp),
                )
                if (identityOk.not() && (ign.isNotEmpty() || uid.isNotEmpty())) {
                    Text(
                        "IGN needs 2-30 characters and the UID must be 6-12 digits.",
                        fontSize = DemoText.Tiny,
                        color = DemoColors.TextFaint,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }

            if (errorText != null) {
                Box(modifier = Modifier.padding(top = 8.dp)) {
                    DemoMessage(errorText)
                }
            }

            // Entry fee vs wallet.
            Column(
                modifier = Modifier
                    .padding(top = 10.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.CardElevated)
                    .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
                    .padding(12.dp),
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Entry Fee", fontSize = DemoText.Body, fontWeight = FontWeight.Bold, color = DemoColors.TextPrimary)
                    Text(
                        "₹${formatMoney(tournament.entryFeeValue)}",
                        fontSize = DemoText.Title,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                    )
                }
                Row(
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("Your Available Balance", fontSize = DemoText.Body, fontWeight = FontWeight.Bold, color = DemoColors.TextPrimary)
                    Text(
                        "₹${formatMoney(balance)}",
                        fontSize = DemoText.Title,
                        fontWeight = FontWeight.Black,
                        color = if (canAfford) DemoColors.Success else DemoColors.Danger,
                    )
                }
                if (!canAfford) {
                    Text(
                        "+ Top up wallet to continue",
                        fontSize = DemoText.Small,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                        modifier = Modifier
                            .padding(top = 6.dp)
                            .clickable(onClick = onTopUp),
                    )
                }
            }

            GoldButton(
                text = when {
                    joined -> "Slot Already Secured"
                    entryClosed -> "Entry closed — joining stops 1 min before start"
                    joining -> "Booking your slot..."
                    canAfford -> "Confirm & Join Slot"
                    else -> "Add Cash to Join"
                },
                onClick = {
                    if (joined) onDismiss() else if (!canAfford) onTopUp() else onJoin(ign.trim(), uid.trim())
                },
                enabled = !joining && !entryClosed && canAfford && identityOk && !joined,
                loading = joining,
                modifier = Modifier
                    .padding(top = 16.dp)
                    .fillMaxWidth()
                    .height(48.dp),
            )

            Text(
                "By joining you agree to the Arena fair-play rules.",
                fontSize = DemoText.Tiny,
                color = DemoColors.TextFaint,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun InfoBox(label: String, value: String, sub: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Field)
            .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
            .padding(12.dp),
    ) {
        Text(label.uppercase(), fontSize = DemoText.Tiny, fontWeight = FontWeight.Bold, color = DemoColors.TextMuted)
        Text(
            value,
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextPrimary,
            modifier = Modifier.padding(top = 4.dp),
        )
        Text(sub, fontSize = DemoText.Small, color = DemoColors.TextFaint, modifier = Modifier.padding(top = 2.dp))
    }
}

