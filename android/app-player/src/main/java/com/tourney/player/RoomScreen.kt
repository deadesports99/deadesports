package com.tourney.player

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.RoomCredentials
import com.tourney.core.model.Tournament
import com.tourney.core.network.ApiClient
import com.tourney.core.network.apiCall
import com.tourney.core.ui.formatMatchTime
import com.tourney.player.ui.common.DemoBackground
import com.tourney.player.ui.common.SpartanCrest
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoRadius
import com.tourney.player.ui.theme.DemoText
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Custom Room page (opened from the push notification / a seated match card).
 *
 * Demo-styled on purpose (same palette, radii and type scale as the lobby, the
 * wallet and the sheets) because the old Material3 version looked like a
 * different app. Layout is deliberately short:
 *   1. match strip — which match this room belongs to (name • map • mode • time)
 *   2. status — lobby open / not published yet
 *   3. Room ID + Password, each with 1-tap copy, plus "copy both"
 *
 * Polls quietly so a code the organiser corrects after publishing appears here
 * without the player leaving the screen.
 */
@Composable
fun RoomScreen(
    tournamentId: String,
    viewModel: MatchViewModel,
    onBack: () -> Unit,
    tournament: Tournament? = null,
) {
    val clipboard = LocalClipboardManager.current
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()

    val state = viewModel.roomState
    var copiedKey by remember { mutableStateOf<String?>(null) }

    // Which match is this room for? Prefer the row the lobby passed in (instant),
    // otherwise ask the API — a push notification can land here after the match
    // left the player feed, and the strip must still name the right match.
    var match by remember(tournamentId) { mutableStateOf(tournament) }
    LaunchedEffect(tournamentId) {
        if (match == null) {
            runCatching { apiCall { ApiClient.tourneyApi.tournamentDetails(tournamentId) } }
                .onSuccess { match = it }
        }
    }

    // Feed data may already carry the credentials — show them instantly instead
    // of a spinner flash while /room is in flight.
    val creds: RoomCredentials? = (state as? RoomState.Ready)?.credentials ?: match?.room

    // Load once, then keep checking: 15s while locked, 30s while open.
    LaunchedEffect(tournamentId) {
        viewModel.loadRoom(tournamentId)
        while (true) {
            if (viewModel.roomState is RoomState.Error) break
            delay(if (viewModel.roomState is RoomState.Locked) 15_000L else 30_000L)
            viewModel.refreshRoom(tournamentId)
        }
    }

    fun copyValue(key: String, label: String, value: String) {
        if (value.isBlank()) return
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        clipboard.setText(AnnotatedString(value))
        copiedKey = key
        scope.launch {
            delay(1800L)
            if (copiedKey == key) copiedKey = null
        }
    }

    DemoBackground {
        Column(modifier = Modifier.fillMaxSize()) {

            // ── Header: back + title + poll status ───────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(DemoRadius.Field))
                        .background(DemoColors.Card)
                        .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
                        .clickable(onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = DemoColors.TextSecondary,
                        modifier = Modifier.size(16.dp),
                    )
                }
                SpartanCrest(size = 30.dp)
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 8.dp),
                ) {
                    Text(
                        "Custom Room",
                        fontSize = DemoText.Title,
                        fontWeight = FontWeight.Black,
                        color = DemoColors.TextPrimary,
                    )
                    Text(
                        "Room ID & Password",
                        fontSize = DemoText.Micro,
                        fontWeight = FontWeight.Bold,
                        color = DemoColors.TextMuted,
                    )
                }
                Box(
                    modifier = Modifier
                        .size(30.dp)
                        .clip(RoundedCornerShape(DemoRadius.Field))
                        .clickable { viewModel.refreshRoom(tournamentId) },
                    contentAlignment = Alignment.Center,
                ) {
                    if (viewModel.roomRefreshing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(13.dp),
                            color = DemoColors.Gold,
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Icon(
                            Icons.Filled.Refresh,
                            contentDescription = "Refresh",
                            tint = DemoColors.TextMuted,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // ── 1. Which match is this room for? ────────────────────
                match?.let { MatchStrip(tournament = it) }

                // ── 2 + 3. Status and the two codes ─────────────────────
                when {
                    creds != null -> {
                        val roomId = creds.roomId.orEmpty()
                        val roomPass = creds.roomPassword.orEmpty()

                        Row(
                            modifier = Modifier.padding(top = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(DemoColors.Success),
                            )
                            Text(
                                "MATCH LOBBY OPEN",
                                fontSize = DemoText.Micro,
                                fontWeight = FontWeight.Black,
                                color = DemoColors.Success,
                            )
                        }

                        RoomValueBox(
                            label = "Room ID",
                            value = roomId,
                            copied = copiedKey == "roomId",
                            onCopy = { copyValue("roomId", "Room ID", roomId) },
                        )
                        RoomValueBox(
                            label = "Room Password",
                            value = roomPass,
                            copied = copiedKey == "roomPass",
                            onCopy = { copyValue("roomPass", "Room password", roomPass) },
                        )

                        Box(
                            modifier = Modifier
                                .padding(top = 2.dp)
                                .fillMaxWidth()
                                .height(44.dp)
                                .clip(RoundedCornerShape(DemoRadius.Field))
                                .background(
                                    if (copiedKey == "both") DemoColors.Success else DemoColors.Gold
                                )
                                .clickable {
                                    copyValue(
                                        "both",
                                        "Room ID & password",
                                        "Room ID: $roomId | Pass: $roomPass",
                                    )
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                if (copiedKey == "both") "Copied — paste in Free Fire"
                                else "Copy Room ID & Password",
                                fontSize = DemoText.BodyStrong,
                                fontWeight = FontWeight.Black,
                                color = if (copiedKey == "both") Color.White else DemoColors.OnGold,
                            )
                        }

                        Text(
                            "Free Fire → Custom → Room me ye code daalein. " +
                                "Kisi ko share na karein.",
                            fontSize = DemoText.Tiny,
                            color = DemoColors.TextMuted,
                            lineHeight = 13.sp,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }

                    state is RoomState.Locked || state is RoomState.Loading -> {
                        Column(
                            modifier = Modifier
                                .padding(top = 8.dp)
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(DemoRadius.Card))
                                .background(DemoColors.Card)
                                .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
                                .padding(horizontal = 16.dp, vertical = 22.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(46.dp)
                                    .clip(CircleShape)
                                    .background(DemoColors.ChipBg),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (state is RoomState.Loading) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        color = DemoColors.Gold,
                                        strokeWidth = 2.dp,
                                    )
                                } else {
                                    Icon(
                                        Icons.Filled.Lock,
                                        contentDescription = null,
                                        tint = DemoColors.TextMuted,
                                        modifier = Modifier.size(20.dp),
                                    )
                                }
                            }
                            Spacer(Modifier.height(10.dp))
                            Text(
                                if (state is RoomState.Loading) "Checking room release…"
                                else "Room ID not published yet",
                                fontSize = DemoText.BodyStrong,
                                fontWeight = FontWeight.Black,
                                color = DemoColors.TextPrimary,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Organiser room publish karte hi ID aur Password yahin aayenge. " +
                                    "Ye screen apne aap check karti rehti hai.",
                                fontSize = DemoText.Tiny,
                                color = DemoColors.TextMuted,
                                textAlign = TextAlign.Center,
                                lineHeight = 13.sp,
                            )
                            if (state is RoomState.Locked) {
                                Spacer(Modifier.height(12.dp))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(DemoRadius.Field))
                                        .background(DemoColors.ChipBg)
                                        .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
                                        .clickable { viewModel.refreshRoom(tournamentId) }
                                        .padding(horizontal = 14.dp, vertical = 8.dp),
                                ) {
                                    Text(
                                        "Check again",
                                        fontSize = DemoText.Tiny,
                                        fontWeight = FontWeight.Black,
                                        color = DemoColors.TextSecondary,
                                    )
                                }
                            }
                        }
                    }

                    state is RoomState.Error -> {
                        Column(
                            modifier = Modifier
                                .padding(top = 8.dp)
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(DemoRadius.Card))
                                .background(DemoColors.Card)
                                .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Card))
                                .padding(horizontal = 16.dp, vertical = 22.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                state.message,
                                fontSize = DemoText.Tiny,
                                color = DemoColors.Danger,
                                textAlign = TextAlign.Center,
                                lineHeight = 13.sp,
                            )
                            Spacer(Modifier.height(12.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(DemoRadius.Field))
                                    .background(DemoColors.ChipBg)
                                    .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
                                    .clickable { viewModel.loadRoom(tournamentId) }
                                    .padding(horizontal = 14.dp, vertical = 8.dp),
                            ) {
                                Text(
                                    "Try again",
                                    fontSize = DemoText.Tiny,
                                    fontWeight = FontWeight.Black,
                                    color = DemoColors.TextSecondary,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Compact "which match" card: number, map • mode, org title, kickoff time. */
@Composable
private fun MatchStrip(tournament: Tournament) {
    // The organiser's title is only worth a line when it is not just the auto
    // name ("27 | Bermuda Solo") — otherwise it repeats map • mode.
    val customTitle = tournament.title.trim().takeIf { title ->
        title.isNotBlank() &&
            !title.contains(tournament.displayName, ignoreCase = true) &&
            !(title.contains(tournament.mapLabel, ignoreCase = true) &&
                title.contains(tournament.matchTypeLabel, ignoreCase = true))
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Card)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
            .padding(horizontal = 11.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        tournament.matchNumber?.let { number ->
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(DemoColors.Cyan.copy(alpha = 0.14f))
                    .padding(horizontal = 7.dp, vertical = 3.dp),
            ) {
                Text(
                    number.toString(),
                    fontSize = DemoText.Small,
                    fontWeight = FontWeight.Black,
                    color = DemoColors.Cyan,
                )
            }
            Spacer(Modifier.width(8.dp))
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${tournament.mapLabel} • ${tournament.matchTypeLabel}",
                fontSize = DemoText.BodyStrong,
                fontWeight = FontWeight.Black,
                color = DemoColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                customTitle
                    ?: tournament.matchNumber?.let { "Match $it" }
                    ?: "Custom Room",
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 1.dp),
            )
        }

        Text(
            formatMatchTime(tournament.matchTime),
            fontSize = DemoText.Micro,
            fontWeight = FontWeight.Bold,
            color = DemoColors.TextMuted,
            textAlign = TextAlign.End,
            modifier = Modifier.padding(start = 8.dp),
        )
    }
}

/** Label + big monospace code + Copy, one compact line. */
@Composable
private fun RoomValueBox(
    label: String,
    value: String,
    copied: Boolean,
    onCopy: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(DemoRadius.Field))
            .background(DemoColors.Field)
            .border(1.dp, DemoColors.BorderSoft, RoundedCornerShape(DemoRadius.Field))
            .padding(start = 11.dp, end = 8.dp, top = 7.dp, bottom = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                label.uppercase(),
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Bold,
                color = DemoColors.TextMuted,
                letterSpacing = 0.8.sp,
            )
            Text(
                value.ifBlank { "—" },
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.sp,
                color = DemoColors.TextPrimary,
                maxLines = 1,
            )
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(7.dp))
                .background(if (copied) DemoColors.Success else DemoColors.ChipBg)
                .clickable(onClick = onCopy)
                .padding(horizontal = 10.dp, vertical = 5.dp),
        ) {
            Text(
                if (copied) "Copied" else "Copy",
                fontSize = DemoText.Micro,
                fontWeight = FontWeight.Black,
                color = if (copied) Color.White else DemoColors.TextSecondary,
            )
        }
    }
}
