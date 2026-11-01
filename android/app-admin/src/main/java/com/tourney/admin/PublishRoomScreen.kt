package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
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

/**
 * Publish Room ID (canUpdateRoomId) — staff inputs the custom room credentials;
 * players unlock them exactly T-15 min before the match via the countdown gate.
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

    val listState = viewModel.tournamentsUi
    val publishState = viewModel.publishUi

    LaunchedEffect(Unit) { if (listState is AdminUi.Idle) viewModel.loadTournaments() }

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
                is AdminUi.Error -> ErrorState(listState.message) { viewModel.loadTournaments() }
                is AdminUi.Success -> {
                    val selectable = listState.data.items.filter {
                        it.status.name in setOf("OPEN", "SLOTS_FULL", "UPCOMING", "ROOM_REVEALED", "LIVE", "UNDER_REVIEW")
                    }
                    if (selectable.isEmpty()) {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Text("No active tournaments to publish a room for.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    } else {
                        selectable.forEach { t ->
                            TournamentRow(
                                t = t,
                                selected = t.id == selectedId,
                                onClick = { selectedId = t.id },
                            )
                        }
                    }
                }
            }

            if (selectedId != null) {
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

                when (publishState) {
                    is AdminUi.Error -> Text(publishState.message, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    is AdminUi.Success<*> -> if (!done) {
                        Text(
                            "✅ Room published — players see it at T-15 min.",
                            color = MaterialTheme.colorScheme.tertiary,
                            fontSize = 13.sp,
                        )
                    }
                    else -> {}
                }

                AppButton(
                    text = if (publishState is AdminUi.Loading) "Publishing…" else "Publish & Unlock Room",
                    enabled = (publishState !is AdminUi.Loading) && roomId.isNotBlank() && roomPassword.isNotBlank(),
                    onClick = {
                        done = true
                        viewModel.publishRoom(selectedId!!, roomId.trim(), roomPassword.trim())
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun TournamentRow(t: Tournament, selected: Boolean, onClick: () -> Unit) {
    androidx.compose.material3.Surface(
        onClick = onClick,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
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
            Text(
                t.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "${t.matchType.name} • ${t.mapType.name} • ${t.slotsBooked}/48 booked • ${t.status.name}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp,
            )
        }
    }
}