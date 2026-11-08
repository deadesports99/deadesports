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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.VpnKey
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.Tournament
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney
import com.tourney.player.ui.common.DemoCompactField
import com.tourney.player.ui.common.DemoMessage
import com.tourney.player.ui.common.GoldButton
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText

/**
 * Quick-join bottom sheet, matched 1:1 to the approved demo
 * (`ui-ux demo/finel demo → MatchSheet.tsx`) and tightened for a 400dp-wide phone:
 *
 * - same header (eyebrow / title / close), map+time grid, prize row, fee block, gold CTA
 * - the two extra fields the organiser needs (In-Game Name + Free Fire UID) sit
 *   side-by-side in one compact strip instead of a full-width block
 * - when the organiser already published the room, a small Room ID / Password
 *   strip appears with per-field copy buttons; a joined player reads the code
 *   there, a not-yet-joined player is told the code unlocks after joining
 * - every label/box is one step smaller than before so the whole sheet fits on
 *   screen without scrolling on a normal phone
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
    /**
     * No seats left. Either the card already says "0 left" or the server just
     * answered "Slot Full" for this player — the CTA stops offering a join.
     */
    slotFull: Boolean = false,
    defaultIgn: String,
    defaultUid: String,
    onDismiss: () -> Unit,
    onJoin: (ign: String, uid: String) -> Unit,
    onTopUp: () -> Unit,
    /** Organiser published the room (status ROOM_REVEALED). */
    roomPublished: Boolean = false,
    /** Room ID & Password, non-null only for a seated player. */
    roomId: String? = null,
    roomPassword: String? = null,
    /** Called after a successful 1-tap copy so the host can toast. */
    onCopied: (String) -> Unit = {},
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var ign by remember(tournament.id) { mutableStateOf(defaultIgn) }
    var uid by remember(tournament.id) { mutableStateOf(defaultUid) }

    val clipboard = LocalClipboardManager.current
    var copiedKey by remember(tournament.id) { mutableStateOf<String?>(null) }
    val copyValue: (String, String, String) -> Unit = { key, label, value ->
        if (value.isNotEmpty()) {
            clipboard.setText(AnnotatedString(value))
            copiedKey = key
            onCopied("$label copied")
        }
    }
    // Clear the tick mark after a moment, exactly like the wallet copy buttons.
    LaunchedEffect(copiedKey) {
        if (copiedKey != null) {
            kotlinx.coroutines.delay(1600L)
            copiedKey = null
        }
    }

    // Prefill once the profile arrives after the sheet is already open.
    LaunchedEffect(defaultIgn, defaultUid) {
        if (ign.isBlank()) ign = defaultIgn
        if (uid.isBlank()) uid = defaultUid
    }

    // First join ever -> ask for IGN + UID. After the API saves them as the player's
    // default, show the saved identity with a "Change" link instead of the inputs.
    val savedIgn = defaultIgn.trim()
    val savedUid = defaultUid.trim()
    val hasSavedIdentity = savedIgn.length in 2..30 && savedUid.length in 6..12
    var editingIdentity by remember(tournament.id) { mutableStateOf(!hasSavedIdentity) }

    // The sheet can display the saved identity instead of the inputs, so the
    // values that will actually be sent are the effective ones — validating the
    // raw `ign`/`uid` state left the join button disabled on the saved-identity
    // row (it looked ready but did nothing).
    val effectiveIgn = ign.trim().ifBlank { defaultIgn.trim() }
    val effectiveUid = uid.trim().ifBlank { defaultUid.trim() }
    val ignOk = effectiveIgn.length in 2..30
    val uidOk = effectiveUid.length in 6..12 && effectiveUid.all { it.isDigit() }
    val canAfford = balance >= tournament.entryFeeValue
    val identityOk = ignOk && uidOk

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DemoColors.Card,
        contentColor = DemoColors.TextPrimary,
        shape = RoundedCornerShape(topStart = DemoRadius.Sheet, topEnd = DemoRadius.Sheet),
        dragHandle = {},
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(horizontal = 16.dp)
                .padding(bottom = 18.dp),
        ) {
            // Grab bar (compact — the default one eats vertical space).
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(top = 10.dp, bottom = 6.dp)
                    .width(38.dp)
                    .height(3.dp)
                    .clip(RoundedCornerShape(DemoRadius.Pill))
                    .background(DemoColors.TextMuted.copy(alpha = 0.35f)),
            )

            // ── Header ────────────────────────────────────────────────────────
            Row(verticalAlignment = Alignment.Top) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "QUICK JOIN • ${tournament.matchTypeLabel.uppercase()}",
                        fontSize = DemoText.Micro,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        tournament.displayName,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 1.dp),
                    )
                    Text(
                        "Review your entry before securing a slot.",
                        fontSize = DemoText.Micro,
                        color = DemoColors.TextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 1.dp),
                    )
                }
                Box(
                    modifier = Modifier
                        .padding(start = 8.dp)
                        .size(24.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(DemoColors.CardMuted)
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = "Close quick join",
                        tint = DemoColors.TextSecondary,
                        modifier = Modifier.size(13.dp),
                    )
                }
            }

            // ── Map & mode / match time ───────────────────────────────────────
            Row(
                modifier = Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
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
                    sub = if (roomId != null) "Room ID published" else "Room ID after you join",
                    modifier = Modifier.weight(1f),
                )
            }

            // ── Prize pool / per kill ─────────────────────────────────────────
            Row(
                modifier = Modifier
                    .padding(top = 6.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.Field)
                    .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                    .padding(horizontal = 8.dp, vertical = 7.dp),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("PRIZE POOL", fontSize = DemoText.Micro, fontWeight = FontWeight.Bold, color = DemoColors.TextMuted)
                    Text(
                        "₹${formatMoney(tournament.prizePoolValue)}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                    )
                }
                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                    Text("PER KILL", fontSize = DemoText.Micro, fontWeight = FontWeight.Bold, color = DemoColors.TextMuted)
                    Text(
                        if (tournament.perKillValue > 0) "₹${formatMoney(tournament.perKillValue)}" else "Win Only",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                    )
                }
            }

            // ── Free Fire identity ───────────────────────────────────────────
            Column(
                modifier = Modifier
                    .padding(top = 6.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.Field)
                    .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                    .padding(horizontal = 8.dp, vertical = 7.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "YOUR FREE FIRE DETAILS",
                        fontSize = DemoText.Micro,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextMuted,
                        modifier = Modifier.weight(1f),
                    )
                    if (hasSavedIdentity && !editingIdentity && !joined) {
                        Text(
                            "Change",
                            fontSize = DemoText.Micro,
                            fontWeight = FontWeight.Black,
                            color = DemoColors.Gold,
                            modifier = Modifier
                                .clickable { editingIdentity = true }
                                .padding(start = 6.dp),
                        )
                    }
                }

                if (hasSavedIdentity && !editingIdentity) {
                    // Saved identity — one calm row, no inputs on repeat joins.
                    Row(
                        modifier = Modifier.padding(top = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            ign.ifBlank { savedIgn },
                            fontSize = DemoText.BodyStrong,
                            fontWeight = FontWeight.Black,
                            color = DemoColors.TextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        Text(
                            "  UID " + uid.ifBlank { savedUid },
                            fontSize = DemoText.Micro,
                            color = DemoColors.TextMuted,
                            maxLines = 1,
                        )
                    }
                } else {
                    Row(
                        modifier = Modifier.padding(top = 5.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Column(modifier = Modifier.weight(1.3f)) {
                            MiniLabel("IGN")
                            DemoCompactField(
                                value = ign,
                                onValueChange = { ign = it.take(30) },
                                placeholder = "SpartanOP",
                                enabled = !joined && !joining,
                                isError = ign.isNotEmpty() && !ignOk,
                                height = 32.dp,
                                textSize = DemoText.Small,
                                modifier = Modifier.padding(top = 3.dp),
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            MiniLabel("FREE FIRE UID")
                            DemoCompactField(
                                value = uid,
                                onValueChange = { uid = it.filter { ch -> ch.isDigit() }.take(12) },
                                placeholder = "6-12 digits",
                                enabled = !joined && !joining,
                                isError = uid.isNotEmpty() && !uidOk,
                                keyboardType = KeyboardType.Number,
                                height = 32.dp,
                                textSize = DemoText.Small,
                                modifier = Modifier.padding(top = 3.dp),
                            )
                        }
                    }
                    if (!identityOk && (ign.isNotEmpty() || uid.isNotEmpty())) {
                        Text(
                            "IGN 2-30 characters • UID 6-12 digits",
                            fontSize = DemoText.Micro,
                            color = DemoColors.TextFaint,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }

            // ── Custom Room ID & Password (organisation published it) ──────
            if (roomPublished) {
                val showRoom = joined && (roomId != null || roomPassword != null)
                Column(
                    modifier = Modifier
                        .padding(top = 6.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(DemoRadius.Field))
                        .background(DemoColors.Field)
                        .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                        .padding(horizontal = 8.dp, vertical = 7.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Filled.VpnKey,
                            contentDescription = null,
                            tint = DemoColors.TextMuted,
                            modifier = Modifier.size(10.dp),
                        )
                        Text(
                            "CUSTOM ROOM DETAILS",
                            fontSize = DemoText.Micro,
                            fontWeight = FontWeight.Bold,
                            color = DemoColors.TextMuted,
                            modifier = Modifier
                                .padding(start = 3.dp)
                                .weight(1f),
                        )
                        Text(
                            if (showRoom) "PUBLISHED" else "JOIN TO UNLOCK",
                            fontSize = DemoText.Micro,
                            fontWeight = FontWeight.Black,
                            color = if (showRoom) DemoColors.Success else DemoColors.Gold,
                        )
                    }

                    Row(
                        modifier = Modifier.padding(top = 5.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        CredentialBox(
                            label = "Room ID",
                            value = roomId,
                            masked = !showRoom,
                            copied = copiedKey == "roomId",
                            modifier = Modifier.weight(1f),
                            onCopy = { copyValue("roomId", "Room ID", roomId.orEmpty()) },
                        )
                        CredentialBox(
                            label = "Password",
                            value = roomPassword,
                            masked = !showRoom,
                            copied = copiedKey == "roomPass",
                            modifier = Modifier.weight(1f),
                            onCopy = { copyValue("roomPass", "Room password", roomPassword.orEmpty()) },
                        )
                    }

                    Text(
                        if (showRoom)
                            "Room is open — copy the ID & password and enter the Free Fire custom room."
                        else
                            "Room ID & Password join karne ke baad yahin milenge (1-tap copy).",
                        fontSize = DemoText.Micro,
                        color = DemoColors.TextFaint,
                        lineHeight = 12.sp,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }

            if (errorText != null) {
                Box(modifier = Modifier.padding(top = 6.dp)) {
                    DemoMessage(errorText)
                }
            }

            // ── Entry fee vs wallet ──────────────────────────────────────────
            Column(
                modifier = Modifier
                    .padding(top = 6.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(DemoRadius.Field))
                    .background(DemoColors.CardElevated)
                    .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
                    .padding(horizontal = 8.dp, vertical = 7.dp),
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Entry Fee", fontSize = DemoText.Small, fontWeight = FontWeight.Bold, color = DemoColors.TextSecondary)
                    Text(
                        "₹${formatMoney(tournament.entryFeeValue)}",
                        fontSize = DemoText.BodyStrong,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                    )
                }
                Row(
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("Your Available Balance", fontSize = DemoText.Small, fontWeight = FontWeight.Bold, color = DemoColors.TextSecondary)
                    Text(
                        "₹${formatMoney(balance)}",
                        fontSize = DemoText.BodyStrong,
                        fontWeight = FontWeight.Black,
                        color = if (canAfford) DemoColors.Success else DemoColors.Danger,
                    )
                }
                if (!canAfford) {
                    Text(
                        "+ Top up wallet to continue",
                        fontSize = DemoText.Micro,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                        modifier = Modifier
                            .padding(top = 3.dp)
                            .clickable(onClick = onTopUp),
                    )
                }
            }

            // ── CTA ──────────────────────────────────────────────────────────
            GoldButton(
                text = when {
                    joined -> "Slot Already Secured"
                    slotFull -> "Slot Full"
                    entryClosed -> "Entry closed — joining stops 1 min before start"
                    joining -> "Booking your slot..."
                    canAfford -> "Confirm & Join Slot"
                    else -> "Add Cash to Join"
                },
                onClick = {
                    if (joined) onDismiss() else if (!canAfford) onTopUp() else onJoin(effectiveIgn, effectiveUid)
                },
                enabled = !joining && !entryClosed && !slotFull && canAfford && identityOk && !joined,
                loading = joining,
                height = 42.dp,
                modifier = Modifier
                    .padding(top = 8.dp)
                    .fillMaxWidth(),
            )

            // Seats gone: say it in plain English, right under the button.
            if (!joined && slotFull) {
                Text(
                    "Slot Full — all seats are taken. Better luck next match.",
                    fontSize = DemoText.Micro,
                    fontWeight = FontWeight.Bold,
                    color = DemoColors.Danger,
                    lineHeight = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .padding(top = 6.dp)
                        .fillMaxWidth(),
                )
            }

            // Tells the player exactly when the Room ID & Password appear.
            if (!joined && !entryClosed && !slotFull) {
                Text(
                    if (roomId != null) "Room ID & Password are above — copy with one tap."
                    else "Custom Room ID & Password join karne ke baad yahin milenge.",
                    fontSize = DemoText.Micro,
                    fontWeight = FontWeight.Bold,
                    color = if (roomId != null) DemoColors.Success else DemoColors.TextMuted,
                    maxLines = 2,
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(top = 4.dp),
                )
            }

            Text(
                "By joining you agree to the Arena fair-play rules.",
                fontSize = DemoText.Micro,
                color = DemoColors.TextFaint,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(top = 4.dp),
            )
        }
    }
}

/**
 * One compact credential box (Room ID / Password) with a 1-tap copy button —
 * two of them fit side-by-side on a 360dp-wide phone, demo styling.
 */
@Composable
private fun CredentialBox(
    label: String,
    value: String?,
    masked: Boolean,
    copied: Boolean,
    modifier: Modifier = Modifier,
    onCopy: () -> Unit,
) {
    val text = value.orEmpty()
    val disabled = masked || text.isEmpty()
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(DemoColors.Card)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(8.dp))
            .padding(start = 8.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                label.uppercase(),
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
                maxLines = 1,
            )
            Text(
                if (masked) "\u2022\u2022\u2022\u2022\u2022\u2022" else text.ifEmpty { "—" },
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                fontFamily = if (masked) FontFamily.Default else FontFamily.Monospace,
                color = if (disabled) DemoColors.TextFaint else DemoColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Box(
            modifier = Modifier
                .size(26.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(if (copied) DemoColors.Success.copy(alpha = 0.15f) else DemoColors.CardMuted)
                .clickable(enabled = !disabled, onClick = onCopy),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = if (copied) Icons.Filled.Check else Icons.Filled.ContentCopy,
                contentDescription = "Copy $label",
                tint = when {
                    copied -> DemoColors.Success
                    disabled -> DemoColors.TextFaint
                    else -> DemoColors.TextSecondary
                },
                modifier = Modifier.size(13.dp),
            )
        }
    }
}

@Composable
private fun MiniLabel(text: String) {
    Text(
        text.uppercase(),
        fontSize = DemoText.Micro,
        fontWeight = FontWeight.Bold,
        color = DemoColors.TextFaint,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
private fun InfoBox(label: String, value: String, sub: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Field)
            .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
            .padding(horizontal = 8.dp, vertical = 7.dp),
    ) {
        Text(label.uppercase(), fontSize = DemoText.Micro, fontWeight = FontWeight.Bold, color = DemoColors.TextMuted)
        Text(
            value,
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 2.dp),
        )
        Text(
            sub,
            fontSize = DemoText.Micro,
            color = DemoColors.TextFaint,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 1.dp),
        )
    }
}
