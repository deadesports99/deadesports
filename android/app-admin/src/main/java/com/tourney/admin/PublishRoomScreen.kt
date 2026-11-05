package com.tourney.admin

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
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
import com.tourney.core.util.TimeAuthority
import java.time.Instant

/**
 * Publish Room ID (canUpdateRoomId).
 *
 * Phase 9 — the admin decides WHEN players see the custom Room ID & Password:
 *   • auto-reveal N minutes before match start (default 15 = old T-15 rule)
 *   • or “Reveal to players now” / “Reveal immediately” at publish time
 */
@Composable
fun PublishRoomScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    var selectedId by remember { mutableStateOf<String?>(null) }
    var roomId by remember { mutableStateOf("") }
    var roomPassword by remember { mutableStateOf("") }
    var revealNowOnPublish by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }

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
        AppTopBar(title = "Publish Room ID", onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Select tournament", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

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
                                    viewModel.clearRoomRevealFeedback()
                                    done = false
                                    revealNowOnPublish = false
                                },
                            )
                        }
                    }
                }
            }

            if (selected != null) {
                // ── Admin-controlled reveal timing ───────────────────────
                val matchEpochMs = runCatching { Instant.parse(selected.matchTime).toEpochMilli() }.getOrNull()
                val revealAtMs = selected.roomRevealAtEpochMs()
                val statusText = when {
                    selected.hasRoomCredentials != true -> "🔒 Room ID & Password not published yet"
                    selected.roomUnlocked == true -> "✅ Visible to joined players right now"
                    revealAtMs != null -> "🕒 Hidden — players see it at ${formatIstFullDateTime(revealAtMs)} IST"
                    else -> "🕒 Hidden until the reveal window"
                }

                GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 14.dp) {
                    Text(
                        "🔑 Room Reveal — ${selected.roomRevealLabel()}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                    )
                    matchEpochMs?.let {
                        Text("Match starts: ${formatIstFullDateTime(it)} IST", fontSize = 11.sp)
                    }
                    Text(
                        statusText,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (selected.roomUnlocked == true) Color(0xFF00C853)
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    Text(
                        "Auto-reveal timing (tap to change):",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                    ) {
                        listOf(
                            5 to "5m", 15 to "15m", 30 to "30m", 60 to "1h",
                            120 to "2h", 360 to "6h", 720 to "12h", 1440 to "24h",
                        ).forEach { (minutes, label) ->
                            FilterChip(
                                selected = selected.roomRevealMinutes == minutes,
                                onClick = {
                                    selectedId?.let {
                                        viewModel.updateRoomReveal(it, roomRevealMinutes = minutes)
                                    }
                                },
                                label = { Text(label, fontSize = 11.sp) },
                            )
                        }
                    }

                    if (selected.hasRoomCredentials == true && selected.roomUnlocked == false) {
                        AppButton(
                            text = if (viewModel.roomRevealBusyId == selected.id) {
                                "⏳ Revealing…"
                            } else {
                                "🔑 Reveal to players now"
                            },
                            enabled = viewModel.roomRevealBusyId == null,
                            onClick = { viewModel.updateRoomReveal(selected.id, revealNow = true) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp),
                        )
                        Text(
                            "Bypasses the countdown — joined players see the code immediately.",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
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

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(
                        selected = revealNowOnPublish,
                        onClick = { revealNowOnPublish = !revealNowOnPublish },
                        label = { Text("Reveal to players immediately", fontSize = 11.sp) },
                    )
                }
                Text(
                    if (revealNowOnPublish) {
                        "⚡ Publish will unlock the code for joined players right now."
                    } else {
                        "🕒 Publish stores the code and unlocks it ${selected.roomRevealLabel()} (or whenever you press Reveal Now)."
                    },
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                when (publishState) {
                    is AdminUi.Error -> Text(publishState.message, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    is AdminUi.Success<*> -> if (done) {
                        val creds = publishState.data as? com.tourney.core.model.RoomCredentials
                        Text(
                            if (creds?.roomUnlocked == true) {
                                "✅ Room published — players can see the Room ID & Password now."
                            } else {
                                "✅ Room saved — players will see it ${creds?.roomRevealMinutes ?: selected.roomRevealMinutes} min before start."
                            },
                            color = MaterialTheme.colorScheme.tertiary,
                            fontSize = 13.sp,
                        )
                    }
                    else -> {}
                }

                AppButton(
                    text = if (publishState is AdminUi.Loading) "Publishing…" else if (revealNowOnPublish) {
                        "Publish & Reveal Now"
                    } else {
                        "Publish Room (auto reveal)"
                    },
                    enabled = (publishState !is AdminUi.Loading) && roomId.isNotBlank() && roomPassword.isNotBlank(),
                    onClick = {
                        done = true
                        viewModel.publishRoom(
                            selectedId!!,
                            roomId.trim(),
                            roomPassword.trim(),
                            revealNowOnPublish,
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun TournamentRow(t: Tournament, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = if (selected) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
        } else {
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
        },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    t.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.fillMaxWidth(0.75f),
                )
                StatusBadge(status = t.status)
            }
            Text(
                "${t.matchType.name} • ${t.mapType.name} • ${t.slotsBooked}/48 booked • " +
                    "reveal ${t.roomRevealLabel()}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
            )
        }
    }
}
