package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentStatus
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import java.time.Duration
import java.time.Instant
import com.tourney.core.ui.StatusBadge
import com.tourney.core.ui.formatDurationShort
import com.tourney.core.ui.formatIstDateTime
import com.tourney.core.ui.formatIstFullDateTime
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.ui.formatMoney
import com.tourney.core.util.TimeAuthority

/**
 * Match Operations — every scheduled / live / finished match with the two
 * "boss buttons": ⚡ Sweep lifecycle now and 🛑 Cancel & refund all.
 * Admins can also tune when each match appears in the player feed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminMatchManagerScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    LaunchedEffect(Unit) { viewModel.loadMatchOps() }

    var cancelTarget by remember { mutableStateOf<Tournament?>(null) }
    var cancelReason by remember { mutableStateOf("Insufficient players") }
    var cloneTarget by remember { mutableStateOf<Tournament?>(null) }
    var cloneTime by remember { mutableStateOf("") }

    // Player-feed visibility editor state.
    var visibilityTarget by remember { mutableStateOf<Tournament?>(null) }
    var visibilityMode by remember { mutableStateOf(MatchVisibilityMode.ALWAYS) }
    var visibilityHoursText by remember { mutableStateOf("10") }

    // Active operations vs the permanent match history (which match happened when).
    var listTab by remember { mutableStateOf(MatchListTab.LIVE) }

    // End Match & Pay Winner dialog state.
    var endTarget by remember { mutableStateOf<Tournament?>(null) }
    var winnerUid by remember { mutableStateOf("") }
    var winnerKills by remember { mutableStateOf("0") }

    val haptics = androidx.compose.ui.platform.LocalHapticFeedback.current

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(title = "Manage Matches", onBack = onBack)

            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                AppButton(
                    text = if (viewModel.opsSweeping) "⏳ Sweeping…" else "⚡ Sweep Lifecycle Now",
                    enabled = !viewModel.opsSweeping,
                    onClick = {
                        haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                        viewModel.sweepNow()
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    "Reveals rooms at each match's reveal time, kicks matches off LIVE, and after 2h moves " +
                        "long-finished matches to REVIEW for result entry. Player app hides a match 3h after kickoff.",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                viewModel.opsMessage?.let {
                    Text("✅ $it", fontSize = 11.sp, color = Color(0xFF00C853), fontWeight = FontWeight.SemiBold)
                }
                viewModel.opsError?.let {
                    Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
                viewModel.cloneMessage?.let {
                    Text("✅ $it", fontSize = 11.sp, color = Color(0xFF00C853), fontWeight = FontWeight.SemiBold)
                }
                viewModel.cloneError?.let {
                    Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
                viewModel.visibilityMessage?.let {
                    Text("✅ $it", fontSize = 11.sp, color = Color(0xFF00C853), fontWeight = FontWeight.SemiBold)
                }
                viewModel.visibilityError?.let {
                    Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
                viewModel.roomRevealMessage?.let {
                    Text("✅ $it", fontSize = 11.sp, color = Color(0xFF00C853), fontWeight = FontWeight.SemiBold)
                }
                viewModel.roomRevealError?.let {
                    Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
                viewModel.finishMessage?.let {
                    Text(it, fontSize = 12.sp, color = Color(0xFF00C853), fontWeight = FontWeight.SemiBold)
                }
                viewModel.finishError?.let {
                    Text("⚠️ $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
            }

            // One console for everything: Live matches, Upcoming matches and the
            // permanent history (which match happened when + Room ID/Pass status).
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                FilterChip(
                    selected = listTab == MatchListTab.LIVE,
                    onClick = { listTab = MatchListTab.LIVE },
                    label = { Text("🔴 Live", fontSize = 11.sp) },
                )
                FilterChip(
                    selected = listTab == MatchListTab.UPCOMING,
                    onClick = { listTab = MatchListTab.UPCOMING },
                    label = { Text("⚡ Upcoming", fontSize = 11.sp) },
                )
                FilterChip(
                    selected = listTab == MatchListTab.HISTORY,
                    onClick = { listTab = MatchListTab.HISTORY },
                    label = { Text("🧾 History", fontSize = 11.sp) },
                )
            }

            PullToRefreshBox(
                isRefreshing = viewModel.isMatchOpsRefreshing,
                onRefresh = {
                    haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                    viewModel.loadMatchOps()
                },
                modifier = Modifier.weight(1f),
            ) {
                when (val state = viewModel.matchOpsUi) {
                    AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading matches…")
                    is AdminUi.Error -> ErrorState(state.message) { viewModel.loadMatchOps() }
                    is AdminUi.Success -> {
                        val nowMs = TimeAuthority.currentTimeMillis()
                        val graceMs = 3 * 60 * 60 * 1000L
                        fun matchMs(t: Tournament): Long? =
                            runCatching { Instant.parse(t.matchTime).toEpochMilli() }.getOrNull()
                        val isFinished = { t: Tournament ->
                            t.status == TournamentStatus.COMPLETED || t.status == TournamentStatus.CANCELLED
                        }
                        val liveStatuses = setOf(
                            TournamentStatus.LIVE,
                            TournamentStatus.ROOM_REVEALED,
                            TournamentStatus.UNDER_REVIEW,
                        )
                        val upcomingStatuses = setOf(
                            TournamentStatus.DRAFT,
                            TournamentStatus.UPCOMING,
                            TournamentStatus.OPEN,
                            TournamentStatus.SLOTS_FULL,
                        )
                        val liveMatches = state.data.items
                            .filter { t ->
                                t.status in liveStatuses &&
                                    (matchMs(t)?.let { it >= nowMs - graceMs } ?: true)
                            }
                            .sortedBy { matchMs(it) ?: 0L }
                        val upcomingMatches = state.data.items
                            .filter { it.status in upcomingStatuses && !isFinished(it) }
                            .sortedBy { matchMs(it) ?: 0L }
                        val historyMatches = state.data.items
                            .filter { t ->
                                val startedLongAgo = matchMs(t)?.let { it < nowMs - graceMs } ?: false
                                isFinished(t) || startedLongAgo
                            }
                            .sortedByDescending { matchMs(it) ?: 0L }
                        val shown = when (listTab) {
                            MatchListTab.LIVE -> liveMatches
                            MatchListTab.UPCOMING -> upcomingMatches
                            MatchListTab.HISTORY -> historyMatches
                        }

                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            item {
                                Text(
                                    when (listTab) {
                                        MatchListTab.LIVE -> "🔴 Live now (${shown.size}) — end & pay winner from here"
                                        MatchListTab.UPCOMING -> "⚡ Upcoming matches (${shown.size})"
                                        MatchListTab.HISTORY -> "🧾 Match history — completed & ended (${shown.size})"
                                    },
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                )
                            }
                            if (shown.isEmpty()) {
                                item {
                                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                                        Text(
                                            when (listTab) {
                                                MatchListTab.LIVE -> "🔴 No live matches right now"
                                                MatchListTab.UPCOMING -> "🎮 No upcoming matches"
                                                MatchListTab.HISTORY -> "🧾 No past matches yet"
                                            },
                                            fontWeight = FontWeight.Bold,
                                        )
                                        Text(
                                            when (listTab) {
                                                MatchListTab.LIVE ->
                                                    "Matches appear here once the room reveal window opens, and stay until you end them."
                                                MatchListTab.UPCOMING ->
                                                    "Create a match first — it will appear here with live slot fill."
                                                MatchListTab.HISTORY ->
                                                    "Every match you create and finish stays recorded here with its date, " +
                                                        "time, status and winner payouts."
                                            },
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                            }
                            items(shown, key = { it.id }) { match ->
                                MatchOpsCard(
                                    match = match,
                                    cancelling = viewModel.opsBusyMatchId == match.id,
                                    cloning = viewModel.cloneBusyMatchId == match.id,
                                    visibilityBusy = viewModel.visibilityBusyMatchId == match.id,
                                    roomBusy = viewModel.roomRevealBusyId == match.id,
                                    finishing = viewModel.finishBusyMatchId == match.id,
                                    onCancel = { cancelTarget = match },
                                    onClone = {
                                        viewModel.clearCloneFeedback()
                                        cloneTarget = match
                                        cloneTime = plusHours(match.matchTime, 1)
                                    },
                                    onFinish = {
                                        viewModel.clearFinishFeedback()
                                        endTarget = match
                                        winnerUid = ""
                                        winnerKills = "0"
                                    },
                                    onVisibility = {
                                        viewModel.clearVisibilityFeedback()
                                        visibilityTarget = match
                                        if (match.visibilityHours != null) {
                                            visibilityMode = MatchVisibilityMode.WITHIN_HOURS
                                            visibilityHoursText = match.visibilityHours.toString()
                                        } else {
                                            visibilityMode = MatchVisibilityMode.ALWAYS
                                            visibilityHoursText = "10"
                                        }
                                    },
                                    onRevealRoom = {
                                        viewModel.clearRoomRevealFeedback()
                                        viewModel.updateRoomReveal(match.id, revealNow = true)
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    cancelTarget?.let { match ->
        AlertDialog(
            onDismissRequest = { cancelTarget = null },
            title = { Text("Cancel “${match.displayName}”?", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(
                        "This refunds all ${match.slotsBooked} booked entry fee(s) — " +
                            "₹${formatMoney(match.entryFeeValue * match.slotsBooked)} total — atomically to each " +
                            "player's wallet, flips the match to CANCELLED and pushes a notification.",
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = cancelReason,
                        onValueChange = { cancelReason = it.take(120) },
                        label = { Text("Reason (players see this)") },
                        isError = cancelReason.trim().length < 5,
                        supportingText = if (cancelReason.trim().length < 5) {
                            { Text("At least 5 characters") }
                        } else null,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    enabled = cancelReason.trim().length >= 5,
                    onClick = {
                        val id = match.id
                        cancelTarget = null
                        viewModel.cancelMatch(id, cancelReason)
                    },
                ) {
                    Text("Cancel & Refund", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { cancelTarget = null }) { Text("Keep match") }
            },
        )
    }

    cloneTarget?.let { match ->
        AlertDialog(
            onDismissRequest = { if (viewModel.cloneBusyMatchId == null) cloneTarget = null },
            title = { Text("📑 Clone match", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Copy ${match.displayName} into a fresh empty match. Choose the next start time:",
                        fontSize = 13.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { cloneTime = plusHours(match.matchTime, 1) }) { Text("+1 Hour") }
                        TextButton(onClick = { cloneTime = plusDays(match.matchTime, 1) }) { Text("Tomorrow") }
                    }
                    Text(
                        "New match: ${formatMatchTime(cloneTime)}",
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        "The cloned match keeps the map, mode, slots, entry fee and prize settings.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                AppButton(
                    text = if (viewModel.cloneBusyMatchId != null) "Cloning…" else "Create Clone",
                    enabled = viewModel.cloneBusyMatchId == null && cloneTime.isNotBlank(),
                    onClick = {
                        viewModel.cloneMatch(match.id, cloneTime)
                        cloneTarget = null
                    },
                )
            },
            dismissButton = {
                TextButton(
                    onClick = { cloneTarget = null },
                    enabled = viewModel.cloneBusyMatchId == null,
                ) { Text("Cancel") }
            },
        )
    }

    // ── Player-feed visibility editor ─────────────────────────────────────
    visibilityTarget?.let { match ->
        val matchEpochMs = runCatching { Instant.parse(match.matchTime).toEpochMilli() }.getOrNull()
        val parsedHours = visibilityHoursText.toIntOrNull()
        val hoursValid = parsedHours != null && parsedHours in 1..336
        val visibleFromMs = if (matchEpochMs != null && hoursValid && parsedHours != null) {
            matchEpochMs - parsedHours * 3_600_000L
        } else null
        val nowMs = TimeAuthority.currentTimeMillis()
        val canSave = visibilityMode == MatchVisibilityMode.ALWAYS || hoursValid
        val saving = viewModel.visibilityBusyMatchId == match.id

        AlertDialog(
            onDismissRequest = { if (!saving) visibilityTarget = null },
            title = { Text("👁️ Player Visibility", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("“${match.displayName}”", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    matchEpochMs?.let {
                        Text("Match starts: ${formatIstFullDateTime(it)} IST", fontSize = 12.sp)
                    }
                    Text(
                        "Choose when this match appears in the players' list:",
                        fontSize = 12.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = visibilityMode == MatchVisibilityMode.ALWAYS,
                            onClick = { visibilityMode = MatchVisibilityMode.ALWAYS },
                            label = { Text("Always visible", fontSize = 11.sp) },
                        )
                        FilterChip(
                            selected = visibilityMode == MatchVisibilityMode.WITHIN_HOURS,
                            onClick = { visibilityMode = MatchVisibilityMode.WITHIN_HOURS },
                            label = { Text("Only near start", fontSize = 11.sp) },
                        )
                    }
                    if (visibilityMode == MatchVisibilityMode.WITHIN_HOURS) {
                        OutlinedTextField(
                            value = visibilityHoursText,
                            onValueChange = { visibilityHoursText = it.filter(Char::isDigit).take(3) },
                            label = { Text("Hours before start") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            isError = !hoursValid,
                            supportingText = {
                                Text(if (hoursValid) "1–336 hours" else "Enter 1 to 336 hours")
                            },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("2", "6", "10", "12", "24").forEach { preset ->
                                FilterChip(
                                    selected = visibilityHoursText == preset,
                                    onClick = { visibilityHoursText = preset },
                                    label = { Text("${preset}h", fontSize = 11.sp) },
                                )
                            }
                        }
                        if (hoursValid && visibleFromMs != null) {
                            Text(
                                if (visibleFromMs <= nowMs) {
                                    "This window is already open — the match is visible now."
                                } else {
                                    "Hidden until ${formatIstFullDateTime(visibleFromMs)} IST " +
                                        "(${formatDurationShort((visibleFromMs - nowMs) / 1000L)} from now)."
                                },
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    } else {
                        Text(
                            "Players see this match in their list immediately.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        "Already-joined players always keep seeing their match.",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    viewModel.visibilityError?.let {
                        Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = canSave && !saving,
                    onClick = {
                        val hours = if (visibilityMode == MatchVisibilityMode.ALWAYS) null else parsedHours
                        val id = match.id
                        visibilityTarget = null
                        viewModel.updateMatchVisibility(id, hours)
                    },
                ) { Text(if (saving) "Saving…" else "Save", fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { visibilityTarget = null }, enabled = !saving) { Text("Cancel") }
            },
        )
    }

    // ── End Match & Pay Winner dialog (admin decides the winner by FF UID) ──
    endTarget?.let { match ->
        val saving = viewModel.finishBusyMatchId == match.id
        val uidValid = Regex("^\\d{6,12}$").matches(winnerUid.trim())
        val killsValue = winnerKills.toIntOrNull()?.coerceIn(0, 99) ?: 0

        AlertDialog(
            onDismissRequest = { if (!saving) endTarget = null },
            title = { Text("🏁 End Match & Pay Winner", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(match.displayName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text(
                        "Winner ko uske Free Fire UID se select karo — rank-1 prize (50% pool + per-kill) uske " +
                            "Winning Balance me turant credit hoga aur match COMPLETED ho jayega.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    OutlinedTextField(
                        value = winnerUid,
                        onValueChange = { winnerUid = it.filter(Char::isDigit).take(12) },
                        label = { Text("Winner Free Fire UID (6-12 digits)") },
                        placeholder = { Text("e.g. 123456789") },
                        singleLine = true,
                        isError = winnerUid.isNotEmpty() && !uidValid,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = winnerKills,
                        onValueChange = { winnerKills = it.filter(Char::isDigit).take(2) },
                        label = { Text("Winner kills (optional)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text(
                        "Prize preview: rank-1 50% of ₹${formatMoney(match.prizePoolValue)}" +
                            " + $killsValue × ₹${formatMoney(match.perKillValue)}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    viewModel.finishError?.let {
                        Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = uidValid && !saving,
                    onClick = {
                        val id = match.id
                        endTarget = null
                        viewModel.finishMatch(id, winnerUid.trim(), killsValue)
                    },
                ) {
                    Text(
                        if (saving) "Paying…" else "End Match & Pay",
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF00C853),
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { endTarget = null }, enabled = !saving) { Text("Cancel") }
            },
        )
    }
}

/** Player-feed visibility choice inside the admin's visibility dialog. */
private enum class MatchVisibilityMode { ALWAYS, WITHIN_HOURS }

/** Active operations vs permanent match history tabs. */
private enum class MatchListTab { LIVE, UPCOMING, HISTORY }

@Composable
private fun MatchOpsCard(
    match: Tournament,
    cancelling: Boolean,
    cloning: Boolean,
    visibilityBusy: Boolean,
    roomBusy: Boolean,
    finishing: Boolean,
    onCancel: () -> Unit,
    onClone: () -> Unit,
    onFinish: () -> Unit,
    onVisibility: () -> Unit,
    onRevealRoom: () -> Unit,
) {
    // Refund/cancel is only valid before kick-off (backend enforces the same list).
    val preMatchStatuses = setOf(
        TournamentStatus.DRAFT,
        TournamentStatus.UPCOMING,
        TournamentStatus.OPEN,
        TournamentStatus.SLOTS_FULL,
        TournamentStatus.ROOM_REVEALED,
    )
    val canCancel = match.status in preMatchStatuses
    val canClone = match.status != TournamentStatus.CANCELLED
    val canEditVisibility = match.status in preMatchStatuses
    // Must mirror the backend's FINISHABLE_STATUSES; UPCOMING/DRAFT cannot be paid.
    val finishableStatuses = setOf(
        TournamentStatus.OPEN,
        TournamentStatus.SLOTS_FULL,
        TournamentStatus.ROOM_REVEALED,
        TournamentStatus.LIVE,
        TournamentStatus.UNDER_REVIEW,
    )
    val canFinish = match.status in finishableStatuses

    // Player-list visibility state (server-computed window, IST labels).
    val nowMs = TimeAuthority.currentTimeMillis()
    val listedFromMs = match.listedFromEpochMs()
    val listedNow = match.isListedBySchedule(nowMs)
    val visibilityText = when {
        listedFromMs == null -> "👁️ Listed to players: immediately"
        listedNow -> "👁️ Listed to players (window opened ${formatIstDateTime(listedFromMs)})"
        else -> "🕒 Hidden — lists to players at ${formatIstDateTime(listedFromMs)} " +
            "(${formatDurationShort((listedFromMs - nowMs) / 1000L)} from now)"
    }
    val visibilityColor = if (listedNow || listedFromMs == null) {
        MaterialTheme.colorScheme.onSurfaceVariant
    } else {
        Color(0xFFFF9800)
    }

    // Admin-controlled Room ID & Password reveal state.
    // NOTE: staff always receive the `room` payload, so "unlocked" must come
    // from the server flag (roomUnlocked), never from `room != null`.
    val hasRoomCreds = match.hasRoomCredentials == true
    val roomUnlocked = match.roomUnlocked == true
    val roomRevealAtMs = match.roomRevealAtEpochMs()
    val roomStatusText = when {
        !hasRoomCreds -> "🔑 ID/Pass: ❌ not published"
        roomUnlocked -> "🔑 ID/Pass: ✅ published — visible to players now"
        roomRevealAtMs != null ->
            "🔑 ID/Pass: ✅ published, hidden until ${formatIstDateTime(roomRevealAtMs)}"
        else -> "🔑 ID/Pass: ✅ published, hidden until the reveal window"
    }
    val roomStatusColor = if (roomUnlocked || !hasRoomCreds) {
        MaterialTheme.colorScheme.onSurfaceVariant
    } else {
        Color(0xFFFF9800)
    }

    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 16.dp, contentPadding = 14.dp) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    match.displayName,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "${match.gameMode.name.replace('_', ' ')} • ₹${formatMoney(match.prizePoolValue)} pool" +
                        (match.matchNumber?.let { " • Match #$it" } ?: ""),
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            StatusBadge(status = match.status)
        }

        Spacer(Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("⏰ ${formatMatchTime(match.matchTime)}", fontSize = 10.sp)
            Text(
                "Seats ${match.slotsBooked}/${match.totalSlots}",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text("₹${formatMoney(match.entryFeeValue)} entry", fontSize = 10.sp)
        }

        Spacer(Modifier.height(3.dp))
        Text(
            visibilityText,
            fontSize = 10.sp,
            color = visibilityColor,
            fontWeight = if (listedNow || listedFromMs == null) FontWeight.Normal else FontWeight.SemiBold,
        )
        Text(
            roomStatusText,
            fontSize = 10.sp,
            color = roomStatusColor,
            fontWeight = if (roomUnlocked || !hasRoomCreds) FontWeight.Normal else FontWeight.SemiBold,
        )

        Spacer(Modifier.height(6.dp))
        LinearProgressIndicator(
            progress = { match.fillFraction },
            modifier = Modifier.fillMaxWidth().height(5.dp),
        )

        Spacer(Modifier.height(12.dp))
        HorizontalDivider()
        Spacer(Modifier.height(10.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (canCancel) {
                AppButton(
                    text = if (cancelling) "⏳ Refunding…" else "🛑 Cancel & Refund",
                    enabled = !cancelling && !cloning,
                    onClick = onCancel,
                    modifier = Modifier.weight(1f),
                )
            }
            AppButton(
                text = if (cloning) "⏳ Cloning…" else "📑 Clone Match",
                enabled = canClone && !cancelling && !cloning,
                onClick = onClone,
                modifier = Modifier.weight(1f),
            )
            if (match.status == TournamentStatus.CANCELLED) {
                Text(
                    "Refunded",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 14.dp),
                )
            }
            Spacer(Modifier.width(2.dp))
        }

        when (match.status) {
            TournamentStatus.UNDER_REVIEW -> Text(
                "🧾 Match ended — enter winner UID below to pay & complete",
                fontSize = 10.sp,
                color = Color(0xFF4A148C),
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 6.dp),
            )
            TournamentStatus.COMPLETED -> Text(
                "✅ Completed — official results published & payouts done",
                fontSize = 10.sp,
                color = Color(0xFF00C853),
                modifier = Modifier.padding(top = 6.dp),
            )
            else -> {}
        }

        if (canFinish) {
            Spacer(Modifier.height(6.dp))
            AppButton(
                text = if (finishing) "⏳ Paying winner…" else "🏁 End Match & Pay Winner (UID)",
                enabled = !finishing && !cancelling && !cloning,
                onClick = onFinish,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (canEditVisibility) {
            Spacer(Modifier.height(4.dp))
            TextButton(
                onClick = onVisibility,
                enabled = !visibilityBusy && !cancelling && !cloning,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    if (visibilityBusy) "⏳ Saving visibility…" else "👁️ Player Visibility Window",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            if (hasRoomCreds && !roomUnlocked) {
                TextButton(
                    onClick = onRevealRoom,
                    enabled = !roomBusy && !cancelling && !cloning,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        if (roomBusy) "⏳ Revealing room…" else "🔑 Reveal Room ID to Players Now",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFFFF9800),
                    )
                }
            }
        }
    }
}

private fun plusHours(iso: String, hours: Long): String = runCatching {
    Instant.parse(iso).plus(Duration.ofHours(hours)).toString()
}.getOrDefault(iso)

private fun plusDays(iso: String, days: Long): String = runCatching {
    Instant.parse(iso).plus(Duration.ofDays(days)).toString()
}.getOrDefault(iso)
