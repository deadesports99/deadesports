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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.ApiException
import com.tourney.core.network.ApiClient
import com.tourney.core.network.apiCall
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * 🔑 CUSTOM ROOM BOTTOM SHEET — same layout/typography as the old full-screen
 * "Custom Room" page, now opened from the match card by a **seated player only**.
 *
 * Non-joined players never see this: their card keeps the plain "Join • ₹X" CTA.
 *
 * Behaviour:
 *  - fetches `GET /tournaments/:id/room` (403 = room not published yet);
 *  - polls every 20s while open, so a Room ID / Password the organiser corrects
 *    AFTER publishing shows up without leaving the sheet (the old screen only
 *    polled while locked, which left stale credentials on screen);
 *  - 1-tap copy for both values.
 */
private sealed interface RoomSheetState {
    data object Loading : RoomSheetState
    data object Locked : RoomSheetState
    data class Ready(val roomId: String, val roomPassword: String) : RoomSheetState
    data class Failure(val message: String) : RoomSheetState
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoomDetailsSheet(
    tournamentId: String,
    tournamentTitle: String,
    onDismiss: () -> Unit,
    onToast: (String) -> Unit = {},
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val clipboard = LocalClipboardManager.current
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()

    var state by remember(tournamentId) { mutableStateOf<RoomSheetState>(RoomSheetState.Loading) }
    var copiedKey by remember(tournamentId) { mutableStateOf<String?>(null) }
    var retryKey by remember(tournamentId) { mutableStateOf(0) }

    LaunchedEffect(tournamentId, retryKey) {
        var firstFetch = true
        while (true) {
            if (firstFetch) state = RoomSheetState.Loading
            try {
                val creds = apiCall { ApiClient.tourneyApi.roomCredentials(tournamentId) }
                state = RoomSheetState.Ready(
                    roomId = creds.roomId.orEmpty(),
                    roomPassword = creds.roomPassword.orEmpty(),
                )
            } catch (e: ApiException) {
                // 403 = the organiser has not published the room yet.
                if (state !is RoomSheetState.Ready) {
                    state = if (e.statusCode == 403) RoomSheetState.Locked
                    else RoomSheetState.Failure(e.message)
                }
            } catch (e: Exception) {
                if (state !is RoomSheetState.Ready) {
                    state = RoomSheetState.Failure("Network error — is the server running?")
                }
            }
            firstFetch = false
            delay(20_000L)
        }
    }

    fun copyValue(key: String, label: String, value: String) {
        if (value.isBlank()) return
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        clipboard.setText(AnnotatedString(value))
        copiedKey = key
        onToast("$label copied")
        scope.launch {
            delay(1800L)
            if (copiedKey == key) copiedKey = null
        }
    }

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
                .padding(horizontal = 14.dp)
                .padding(bottom = 14.dp),
        ) {
            // Grab bar + header (the old screen's "Custom Room" top bar).
            Box(
                modifier = Modifier
                    .padding(top = 6.dp, bottom = 10.dp)
                    .align(Alignment.CenterHorizontally)
                    .size(width = 34.dp, height = 4.dp)
                    .clip(RoundedCornerShape(DemoRadius.Pill))
                    .background(DemoColors.BorderStrong),
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Custom Room",
                        fontSize = DemoText.BodyStrong,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                    )
                    Text(
                        tournamentTitle,
                        fontSize = DemoText.Micro,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextMuted,
                        maxLines = 1,
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(DemoRadius.Field))
                        .background(DemoColors.Field)
                        .border(1.dp, DemoColors.BorderFaint, RoundedCornerShape(DemoRadius.Field))
                        .clickable(onClick = onDismiss)
                        .padding(6.dp),
                ) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = "Close",
                        tint = DemoColors.TextMuted,
                        modifier = Modifier.size(13.dp),
                    )
                }
            }

            when (val current = state) {
                RoomSheetState.Loading -> {
                    Row(
                        modifier = Modifier
                            .padding(top = 14.dp)
                            .fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            color = DemoColors.Gold,
                            strokeWidth = 2.dp,
                        )
                        Text(
                            "Checking room release…",
                            fontSize = DemoText.Small,
                            color = DemoColors.TextMuted,
                        )
                    }
                }

                RoomSheetState.Locked -> {
                    Column(
                        modifier = Modifier
                            .padding(top = 10.dp)
                            .fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("🔒", fontSize = 24.sp)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Room ID not published yet",
                            fontSize = DemoText.Body,
                            fontWeight = FontWeight.Black,
                            color = DemoColors.TextPrimary,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "The organiser publishes the Room ID & Password when the custom room is " +
                                "ready. Keeping this open — it checks again automatically.",
                            fontSize = DemoText.Micro,
                            color = DemoColors.TextMuted,
                            textAlign = TextAlign.Center,
                            lineHeight = 12.sp,
                        )
                        Spacer(Modifier.height(10.dp))
                        TinyAction(text = "🔄 Check again", onClick = { retryKey += 1 })
                    }
                }

                is RoomSheetState.Failure -> {
                    Column(
                        modifier = Modifier
                            .padding(top = 10.dp)
                            .fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("⚠️", fontSize = 22.sp)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            current.message,
                            fontSize = DemoText.Micro,
                            color = DemoColors.Danger,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(10.dp))
                        TinyAction(text = "Try again", onClick = { retryKey += 1 })
                    }
                }

                is RoomSheetState.Ready -> {
                    Text(
                        "Match Lobby Open",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.Success,
                        modifier = Modifier.padding(top = 10.dp),
                    )
                    Text(
                        "Join inside Free Fire → Custom → Room. Do NOT share this code.",
                        fontSize = DemoText.Micro,
                        color = DemoColors.TextMuted,
                        lineHeight = 12.sp,
                        modifier = Modifier.padding(top = 2.dp),
                    )

                    RoomValueBox(
                        label = "Room ID",
                        value = current.roomId,
                        copied = copiedKey == "roomId",
                        onCopy = { copyValue("roomId", "Room ID", current.roomId) },
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    RoomValueBox(
                        label = "Room Password",
                        value = current.roomPassword,
                        copied = copiedKey == "roomPass",
                        onCopy = { copyValue("roomPass", "Room password", current.roomPassword) },
                        modifier = Modifier.padding(top = 6.dp),
                    )

                    // One tap → both values on the clipboard (Free Fire pastes the code).
                    Box(
                        modifier = Modifier
                            .padding(top = 8.dp)
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(DemoRadius.Field))
                            .background(if (copiedKey == "both") DemoColors.Success else DemoColors.Gold)
                            .clickable {
                                copyValue(
                                    "both",
                                    "Room ID & password",
                                    "Room ID: ${current.roomId} | Pass: ${current.roomPassword}",
                                )
                            }
                            .padding(vertical = 9.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            if (copiedKey == "both") "Room ID & Password copied"
                            else "Copy Room ID & Password",
                            fontSize = DemoText.Tiny,
                            fontWeight = FontWeight.Black,
                            color = if (copiedKey == "both") androidx.compose.ui.graphics.Color.White
                            else DemoColors.OnGold,
                        )
                    }
                }
            }
        }
    }
}

/** Card with a big monospace value + Copy — the old Room screen's credential tile. */
@Composable
private fun RoomValueBox(
    label: String,
    value: String,
    copied: Boolean,
    onCopy: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shown = value.ifBlank { "—" }
    // One compact line: label + big value on the left, Copy pinned right.
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Field)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
            .padding(start = 11.dp, end = 8.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                label.uppercase(),
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
                letterSpacing = 0.8.sp,
            )
            Text(
                shown,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.8.sp,
                color = DemoColors.TextPrimary,
                maxLines = 1,
            )
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(7.dp))
                .background(if (copied) DemoColors.Success else DemoColors.ChipBg)
                .clickable(onClick = onCopy)
                .padding(horizontal = 9.dp, vertical = 4.dp),
        ) {
            Text(
                if (copied) "✅ Copied" else "Copy",
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Black,
                color = if (copied) androidx.compose.ui.graphics.Color.White else DemoColors.TextSecondary,
            )
        }
    }
}

@Composable
private fun TinyAction(text: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.ChipBg)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 7.dp),
    ) {
        Text(
            text,
            fontSize = DemoText.Tiny,
            fontWeight = FontWeight.Black,
            color = DemoColors.TextSecondary,
        )
    }
}
