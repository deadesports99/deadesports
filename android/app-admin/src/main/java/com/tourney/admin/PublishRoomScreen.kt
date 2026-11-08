package com.tourney.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.Tournament
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.StatusBadge
import com.tourney.core.ui.formatIstFullDateTime
import com.tourney.core.ui.formatMatchTime
import com.tourney.core.util.TimeAuthority
import java.time.Instant

/**
 * Publish Room ID (canUpdateRoomId) — the ONE place the custom room lives.
 *
 * Owner's rule: players receive the Room ID & Password only when an admin or
 * sub-admin publishes them. There is no clock and no automatic drop, so this
 * screen both publishes and edits an already published room, and it can
 * cancel the match (full auto-refund) without leaving the section.
 */
@Composable
fun PublishRoomScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    var selectedId by remember { mutableStateOf<String?>(null) }
    var roomId by remember { mutableStateOf("") }
    var roomPassword by remember { mutableStateOf("") }
    var done by remember { mutableStateOf(false) }
    var cancelTarget by remember { mutableStateOf<Tournament?>(null) }

    // Dedicated "publishable" list from the backend: only upcoming/open matches.
    // Old LIVE/COMPLETED matches from previous days never appear here.
    val listState = viewModel.publishTargetsUi
    val publishState = viewModel.publishUi

    LaunchedEffect(Unit) { viewModel.loadPublishTargets() }

    // Refresh the list after a successful publish so the status line is current.
    LaunchedEffect(publishState) {
        if (publishState is AdminUi.Success<*>) viewModel.loadPublishTargets()
    }

    val selected = (listState as? AdminUi.Success)?.data?.items?.firstOrNull { it.id == selectedId }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(showBrandBadge = true, title = "Publish Room ID", onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Cancel feedback lives above the picker: the cancelled match disappears
            // from the list immediately, so the message must not be inside its card.
            viewModel.opsMessage?.let {
                Text(
                    "✅ $it",
                    fontSize = 12.sp,
                    color = Color(0xFF00C853),
                    fontWeight = FontWeight.SemiBold,
                )
            }
            viewModel.opsError?.let {
                Text("⚠️ $it", fontSize = 12.sp, color = MaterialTheme.colorScheme.error)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "Select tournament",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                TextButton(onClick = { viewModel.loadPublishTargets() }) {
                    Text("🔄 Refresh", fontSize = 12.sp)
                }
            }

            when (listState) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading tournaments…")
                is AdminUi.Error -> ErrorState(listState.message) { viewModel.loadPublishTargets() }
                is AdminUi.Success -> {
                    // Belt-and-braces client filter on top of the backend filter:
                    // only still-relevant matches, never yesterday's leftovers.
                    val nowMs = TimeAuthority.currentTimeMillis()
                    val selectable = listState.data.items.filter { t ->
                        val matchMs = runCatching { Instant.parse(t.matchTime).toEpochMilli() }.getOrNull()
                        val relevantStatus = t.status.name in setOf("OPEN", "SLOTS_FULL", "UPCOMING", "ROOM_REVEALED")
                        val notLongPast = matchMs != null && matchMs >= nowMs - 60 * 60 * 1000L
                        relevantStatus && notLongPast
                    }
                    if (selectable.isEmpty()) {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                "📭 No active or upcoming matches right now",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                            )
                            Text(
                                "Create a match first (Create Match), then come back here to publish its " +
                                    "Room ID & Password. Yesterday's finished matches are not listed.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 11.sp,
                            )
                            AppButton(
                                text = "🔄 Refresh",
                                onClick = { viewModel.loadPublishTargets() },
                                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                            )
                        }
                    } else {
                        selectable.forEach { t ->
                            TournamentRow(
                                t = t,
                                selected = t.id == selectedId,
                                onClick = {
                                    selectedId = t.id
                                    // Editing an existing room: prefill what players already see.
                                    roomId = t.room?.roomId.orEmpty()
                                    roomPassword = t.room?.roomPassword.orEmpty()
                                    viewModel.clearRoomRevealFeedback()
                                    done = false
                                },
                            )
                        }
                    }
                }
            }

            if (selected != null) {
                val matchEpochMs = runCatching { Instant.parse(selected.matchTime) }.getOrNull()
                    ?.toEpochMilli()
                // Staff always receive `room`, so "published" must come from the
                // server flag (roomRevealedAt) — not from room != null.
                val published = selected.roomUnlocked == true ||
                    selected.status == com.tourney.core.model.TournamentStatus.ROOM_REVEALED

                GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 14.dp) {
                    Text("🔑 Room ID & Password", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    matchEpochMs?.let {
                        Text("Match starts: ${formatIstFullDateTime(it)} IST", fontSize = 11.sp)
                    }
                    Text(
                        when {
                            published -> "✅ Published — joined players can see the code right now"
                            selected.hasRoomCredentials == true ->
                                "🕒 Saved but not published yet — players cannot see it"
                            else -> "🔒 Not published yet"
                        },
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (published) Color(0xFF00C853) else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "Players get the Room ID & Password the moment you publish. There is no timer — " +
                            "publish when the custom room is actually open in Free Fire.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    if (selected.status.name in
                        setOf("DRAFT", "UPCOMING", "OPEN", "SLOTS_FULL", "ROOM_REVEALED")
                    ) {
                        AppButton(
                            text = "🚫 Cancel this match & refund players",
                            onClick = { cancelTarget = selected },
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        )
                    }
                }

                viewModel.roomRevealMessage?.let {
                    Text("✅ $it", fontSize = 12.sp, color = Color(0xFF00C853), fontWeight = FontWeight.SemiBold)
                }
                viewModel.roomRevealError?.let {
                    Text("⚠️ $it", fontSize = 12.sp, color = MaterialTheme.colorScheme.error)
                }

                // ── Publish / update the credentials themselves ─────────
                OutlinedTextField(
                    value = roomId,
                    onValueChange = { roomId = it.take(64) },
                    label = { Text("Room ID (code inside Free Fire)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = roomPassword,
                    onValueChange = { roomPassword = it.take(64) },
                    label = { Text("Room Password") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                Text(
                    if (published) {
                        "✏️ Edit the code below and publish again — players see the new values immediately."
                    } else {
                        "⚡ Publishing shows the code to every joined player right away."
                    },
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                when (publishState) {
                    is AdminUi.Error -> Text(publishState.message, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    is AdminUi.Success<*> -> if (done) {
                        val result = publishState.data as? com.tourney.core.model.RoomCredentials
                        val warning = result?.warning
                        Text(
                            "✅ Room published — every joined player can see the Room ID & Password now.",
                            color = MaterialTheme.colorScheme.tertiary,
                            fontSize = 13.sp,
                        )
                        // Guard rail: publishing to an empty match means nobody can
                        // ever enter — the code is only shown to seated players.
                        if (warning != null) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0x33FFAB00))
                                    .border(1.dp, Color(0xFFFFAB00), RoundedCornerShape(12.dp))
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                            ) {
                                Text(
                                    "⚠️ $warning",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFFFFAB00),
                                    lineHeight = 16.sp,
                                )
                            }
                        } else {
                            val seated = result?.seatedPlayers
                            if (seated != null) {
                                Text(
                                    "👥 $seated joined player${if (seated == 1) "" else "s"} can see this code.",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                    else -> {}
                }

                AppButton(
                    text = when {
                        publishState is AdminUi.Loading -> "Publishing…"
                        published -> "Update & publish to players"
                        else -> "Publish to players"
                    },
                    enabled = (publishState !is AdminUi.Loading) && roomId.isNotBlank() && roomPassword.isNotBlank(),
                    onClick = {
                        done = true
                        viewModel.publishRoom(
                            selectedId!!,
                            roomId.trim(),
                            roomPassword.trim(),
                            revealNow = true,
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
    // ── Cancel the match from the room section (full auto-refund) ────────
    cancelTarget?.let { match ->
        var reason by remember(match.id) { mutableStateOf("Match cancelled by organiser") }
        AlertDialog(
            onDismissRequest = { cancelTarget = null },
            title = { Text("Cancel ${match.displayName}?", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Every booked seat is refunded in one transaction and the match is cancelled " +
                            "for the players. This cannot be undone.",
                        fontSize = 13.sp,
                    )
                    OutlinedTextField(
                        value = reason,
                        onValueChange = { reason = it.take(120) },
                        label = { Text("Reason (players see this)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    enabled = reason.trim().length >= 5,
                    onClick = {
                        val id = match.id
                        cancelTarget = null
                        viewModel.cancelMatch(id, reason)
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
        }
    }
}

@Composable
private fun TournamentRow(t: Tournament, selected: Boolean, onClick: () -> Unit) {
    val published = t.roomUnlocked == true ||
        t.status == com.tourney.core.model.TournamentStatus.ROOM_REVEALED
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(14.dp),
        color = if (selected) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
        } else {
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Same identity as the rest of the app: "50 | Bermuda • Solo".
            Text(
                t.matchNumber?.toString() ?: "—",
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.width(4.dp))
            Text("|", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.width(6.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "${t.mapLabel} • ${t.matchTypeLabel}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "${formatMatchTime(t.matchTime)} • ${t.slotsBooked}/${t.totalSlots} booked • " +
                        if (published) "🔑 published" else "🔒 not published",
                    fontSize = 10.sp,
                    color = if (published) Color(0xFF00C853) else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            StatusBadge(status = t.status)
        }
    }
}
