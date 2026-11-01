package com.tourney.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.MatchType
import com.tourney.core.model.SlotEntry
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState

/**
 * 48-Seat grid (12 rows x 4 cols). Booked seats show IGN, open seats are
 * tappable. DUO/SQUAD matches accept a 6-digit team code to join a friend's
 * squad; without a code the joining player becomes the leader and receives
 * a fresh code to share.
 */
@Composable
fun SlotPickerScreen(
    tournamentId: String,
    matchType: MatchType,
    viewModel: MatchViewModel,
    onBack: () -> Unit,
) {
    val state = viewModel.slotsUi
    var selectedSlot by remember { mutableStateOf<SlotEntry?>(null) }
    var teamCode by remember { mutableStateOf("") }
    val haptics = LocalHapticFeedback.current
    val clipboard = LocalClipboardManager.current
    val result = viewModel.lastJoinResult
    var showTeamCodeDialog by remember { mutableStateOf(result?.teamCode != null) }

    LaunchedEffect(tournamentId) { viewModel.loadSlots(tournamentId) }
    LaunchedEffect(result) { if (result?.teamCode != null) showTeamCodeDialog = true }

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(title = "Select Your Seat", onBack = onBack)

        when (state) {
            UiState.Idle, UiState.Loading -> LoadingState("Loading 48 seats…")
            is UiState.Error -> ErrorState(state.message) { viewModel.loadSlots(tournamentId) }
            is UiState.Success -> {
                val booked = state.data.booked
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                    Text(
                        "Seats booked: $booked / ${state.data.totalSlots}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        if (matchType == MatchType.SOLO)
                            "Tap an empty seat to join this match"
                        else
                            "Team matches: enter a 6-digit squad code, or join without one to become the leader and get a shareable code.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 12.sp,
                    )
                }

                LazyVerticalGrid(
                    columns = GridCells.Fixed(4),
                    modifier = Modifier.fillMaxSize()
                        .padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(state.data.slots, key = { it.slotNumber }) { slot ->
                        SeatCell(
                            slot = slot,
                            selected = slot.slotNumber == selectedSlot?.slotNumber,
                            onClick = { if (!slot.isBooked) selectedSlot = slot },
                        )
                    }
                }
            }
        }
    }

    // Join confirm dialog
    selectedSlot?.let { slot ->
        AlertDialog(
            onDismissRequest = { selectedSlot = null },
            title = { Text("Join slot #${slot.slotNumber}?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Your entry fee will be deducted from your balance.")
                    if (matchType != MatchType.SOLO) {
                        OutlinedTextField(
                            value = teamCode,
                            onValueChange = { teamCode = it.filter(Char::isDigit).take(6) },
                            label = { Text("Squad Code (optional)") },
                            placeholder = { Text("6-digit code") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    viewModel.actionError?.let {
                        Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    }
                }
            },
            confirmButton = {
                AppButton(
                    text = if (viewModel.joining) "Booking…" else "Confirm & Join",
                    enabled = !viewModel.joining,
                    onClick = {
                        viewModel.join(tournamentId, slot.slotNumber, teamCode.ifBlank { null })
                        if (viewModel.actionError == null) {
                            selectedSlot = null
                            teamCode = ""
                        }
                    },
                )
            },
            dismissButton = {
                TextButton(onClick = { selectedSlot = null }) { Text("Cancel") }
            },
        )
    }

    // Leader team-code share dialog
    if (showTeamCodeDialog && result?.teamCode != null) {
        AlertDialog(
            onDismissRequest = { showTeamCodeDialog = false },
            title = { Text("Squad created 🎉") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Your seat: #${result.slotNumber}")
                    Text("Share this 6-digit code with your teammates:", fontSize = 13.sp)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            result.teamCode!!,
                            style = MaterialTheme.typography.displaySmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            },
            confirmButton = {
                AppButton(
                    text = "Copy Code",
                    onClick = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        clipboard.setText(AnnotatedString(result.teamCode!!))
                        showTeamCodeDialog = false
                    },
                )
            },
            dismissButton = {
                TextButton(onClick = { showTeamCodeDialog = false }) { Text("Done") }
            },
        )
    }
}

@Composable
private fun SeatCell(slot: SlotEntry, selected: Boolean, onClick: () -> Unit) {
    val booked = slot.isBooked
    val backgroundColor = when {
        booked -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.75f)
        selected -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
    }
    val contentColor = when {
        booked -> MaterialTheme.colorScheme.onErrorContainer
        selected -> MaterialTheme.colorScheme.onPrimaryContainer
        else -> MaterialTheme.colorScheme.onSurface
    }

    androidx.compose.material3.Surface(
        onClick = { if (!booked) onClick() },
        enabled = !booked,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
        color = backgroundColor,
        contentColor = contentColor,
        modifier = Modifier.height(64.dp),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxSize().padding(4.dp),
        ) {
            Text("#${slot.slotNumber}", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text(
                text = slot.player?.inGameName?.take(10) ?: (if (booked) "Taken" else "Open"),
                fontSize = 10.sp,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
        }
    }
}